// Adapted from the user-supplied llm-router-blueprint. State is isolate-local;
// Cloudflare D1 separately enforces shared request budgets across isolates.
import { classifyError } from './errors';

export const resolveApiKeys = (...sources: (string | null | undefined)[]): string[] =>
  [...new Set(sources.flatMap(source => (source || '').split(/[,;\s]+/)).filter(Boolean))];

const pacificDay = (now: number) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(now));

export class AICapacityError extends Error {
  constructor() { super('AI capacity temporarily unavailable'); }
}

export function createKeyPoolRouter(now = Date.now) {
  const deadKeys = new Set<string>();
  const deadModels = new Set<string>();
  const cooldowns = new Map<string, number>();
  const daily = new Map<string, string>();
  const overloaded = new Map<string, number>();
  const busy = new Set<string>();
  let cursor = 0;
  return {
    async call<T>(models: string[], keys: string[], exec: (model: string, key: string) => Promise<T>): Promise<T> {
      const offset = keys.length ? cursor++ % keys.length : 0;
      const orderedKeys = [...keys.slice(offset), ...keys.slice(0, offset)];
      for (const model of [...new Set(models)]) {
        if (deadModels.has(model) || (overloaded.get(model) || 0) > now()) continue;
        for (const key of orderedKeys) {
          const pair = `${model}:${key}`;
          if (deadKeys.has(key) || busy.has(pair) || (cooldowns.get(pair) || 0) > now()
            || daily.get(pair) === pacificDay(now())) continue;
          busy.add(pair);
          try {
            const result = await exec(model, key);
            cooldowns.delete(pair);
            return result;
          } catch (error) {
            const kind = classifyError(error);
            if (!kind) throw error;
            if (kind.class === 'invalid-key') deadKeys.add(key);
            else if (kind.class === 'invalid-model') { deadModels.add(model); break; }
            else if (kind.class === 'transient') { overloaded.set(model, now() + 30_000); break; }
            else if (kind.quota === 'rpd') daily.set(pair, pacificDay(now()));
            else cooldowns.set(pair, now() + 60_000);
          } finally { busy.delete(pair); }
        }
      }
      // Fail fast instead of waiting through cooldowns and missing an alarm.
      // Do not propagate provider messages, which may contain credentials.
      throw new AICapacityError();
    },
  };
}
