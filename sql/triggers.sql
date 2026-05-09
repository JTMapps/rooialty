SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname   AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal   -- omit internal/system triggers
ORDER BY schema_name, table_name, trigger_name;