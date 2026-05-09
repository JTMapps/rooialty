SELECT
  n.nspname AS schema_name,
  t.typname AS enum_type,
  e.enumlabel AS enum_label,
  e.enumsortorder AS enum_sort_order
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
ORDER BY schema_name, enum_type, enum_sort_order;