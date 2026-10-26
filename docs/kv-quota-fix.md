# KV list quota fix: D1-backed alarm device registry

## Why

The previous cron ran every minute and called `AETHERCLOCK_KV.list({ prefix: 'device:' })` regardless of the number of active alarms. That is 1,440 list requests/day, above the Workers Free limit of 1,000/day.

The cron remains minute-accurate. A D1 table now holds the device IDs that may have active push alarms; the full device records remain in the existing KV namespace. This avoids per-minute KV `list` requests, and D1 provides atomic registry membership updates rather than a concurrent read-modify-write of a KV manifest.

## Deployment prerequisites (required before merging/deploying)

1. In the same Cloudflare account as `AETHERCLOCK_KV`, create a D1 database named `aetherclock-alarm-index`:

   `pnpm exec wrangler d1 create aetherclock-alarm-index`

2. Record the real `database_id`. Configure a D1 binding named **`ALARM_DB`** in both the Pages project (`aetherclock`) and the separately deployed Worker (`aetherclock-cron-worker`). Add the following to each Wrangler config, substituting the actual ID:

   ```toml
   [[d1_databases]]
   binding = "ALARM_DB"
   database_name = "aetherclock-alarm-index"
   database_id = "<REAL_D1_DATABASE_ID>"
   migrations_dir = "migrations"
   ```

   For `cron-worker/wrangler.toml`, set `migrations_dir = "../migrations"` if the path is resolved relative to that file. If the Pages project is configured in the Cloudflare dashboard instead of Wrangler, set the same binding there and redeploy Pages.

3. Apply `migrations/0001_alarm_registry.sql` to the **remote** D1 database before updating either deployment:

   `pnpm exec wrangler d1 execute aetherclock-alarm-index --remote --file=migrations/0001_alarm_registry.sql`

4. Deploy the updated Pages Functions first, then the updated Cron Worker (`pnpm run deploy:cron`). Do not remove the existing KV binding. Check Worker logs and the `ALARM_DB` binding before treating the rollout as complete.

5. On its first successful run, the new Cron Worker performs a one-time `device:` key inventory from KV and populates D1. This is idempotent and preserves existing devices; the marker `kv_device_import_v1` prevents further scans. If the daily `list` quota is already exhausted, the initial import may fail until the next 00:00 UTC reset. Avoid deploying during a quota-exhausted window unless a temporary alarm disruption is acceptable.

6. Verify the `alarm_registry_devices` table and a real subscribed test alarm. Cloudflare KV metrics should show no recurring `list` requests after the one-time import. Verify push delivery for newly registered, edited, unsubscribed, and existing devices, including a DST boundary test.

## Rollback

Both configurations must be rolled back together. The previous Cron Worker still uses the unchanged KV records, so restoring the previous deployment is possible, but it reinstates the original daily quota problem. **Do not delete either storage resource during rollback.**

## Capacity note

This removes the `list` bottleneck, not every scaling limit. The Cron Worker still reads one KV record per eligible device every minute. At roughly 70 continuously eligible devices, those reads alone can approach the Free Tier's 100,000 KV reads/day. At that point, replace the minute-wide enumeration with an indexed due-alarm schedule or per-device Durable Object alarms.
