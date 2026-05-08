SELECT
  ns.nspname AS schema_name,
  pol.polname AS policy_name,
  CASE
    WHEN pol.polcmd = 'r' THEN 'SELECT'
    WHEN pol.polcmd = 'a' THEN 'INSERT'
    WHEN pol.polcmd = 'w' THEN 'UPDATE'
    WHEN pol.polcmd = 'd' THEN 'DELETE'
    ELSE pol.polcmd::text
  END AS for_command,
  r.rolname AS role_name,
  pol.polpermissive AS permissive,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression,
  (
    'CREATE POLICY "' || pol.polname || '" ON ' ||
    ns.nspname || '.' || cls.relname ||
    ' FOR ' ||
    CASE
      WHEN pol.polcmd = 'r' THEN 'SELECT'
      WHEN pol.polcmd = 'a' THEN 'INSERT'
      WHEN pol.polcmd = 'w' THEN 'UPDATE'
      WHEN pol.polcmd = 'd' THEN 'DELETE'
      ELSE pol.polcmd::text
    END ||
    ' TO ' || COALESCE(r.rolname, 'PUBLIC') ||
    ' USING (' || COALESCE(pg_get_expr(pol.polqual, pol.polrelid)::text, 'TRUE') || ')' ||
    CASE
      WHEN pol.polwithcheck IS NULL THEN ''
      ELSE ' WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid)::text || ')'
    END
  ) AS policy_definition_text
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
LEFT JOIN pg_roles r
  ON r.oid = ANY (pol.polroles)
WHERE ns.nspname = 'public'
ORDER BY schema_name, policy_name;