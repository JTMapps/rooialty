-- Tables
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p','v','m') -- table, partitioned table, view, materialized view
ORDER BY schema_name, table_name;

-- Columns + column definitions (type, nullability, default, etc.)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  (
    CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE 'NULL' END
  ) AS nullability,
  pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
  (
    pg_catalog.format_type(a.atttypid, a.atttypmod)
    || ' ' ||
    CASE WHEN a.attnotnull THEN 'NOT NULL' ELSE 'NULL' END
    || COALESCE(' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid), '')
  ) AS column_definition
FROM pg_attribute a
JOIN pg_class c
  ON c.oid = a.attrelid
JOIN pg_namespace n
  ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef ad
  ON ad.adrelid = a.attrelid
 AND ad.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')  -- only real/partitioned tables
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY schema_name, table_name, column_name;

-- (Optional) If you also want constraints (PK/unique/check/foreign keys), tell me and I’ll extend it.