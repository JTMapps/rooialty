SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_definition
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY schema_name, table_name, index_name;