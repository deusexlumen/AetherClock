-- The KV namespace keeps device records. D1 is only an atomic membership index.
CREATE TABLE IF NOT EXISTS alarm_registry_devices (
  device_id TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS alarm_registry_meta (
  name TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
