import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import { checkAndFireAlarms, type Env } from './alarmChecker';

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkAndFireAlarms(env));
  },
};
