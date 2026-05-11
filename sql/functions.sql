-- Get all functions in the `public` schema with their definitions
SELECT
  n.nspname                               AS schema_name,
  p.proname                               AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arg_signature,
  pg_get_userbyid(p.proowner)             AS owner_role,
  p.prosecdef                             AS security_definer,
  p.prolang::regtype::text                AS language,
  pg_get_functiondef(p.oid)              AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, arg_signature;