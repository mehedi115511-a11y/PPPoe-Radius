-- Task 24 READ-ONLY ownership preflight; do not backfill by role alone.
-- Check unique user candidates for each legacy owner role.
SELECT role, count(*) AS accounts FROM app_users GROUP BY role ORDER BY role;
-- Check legacy rows needing an explicit owner mapping.
SELECT owner_role, count(*) AS client_rows FROM app_clients GROUP BY owner_role;
SELECT owner_role, count(*) AS package_rows FROM app_packages GROUP BY owner_role;
-- Inspect parent hierarchy anomalies before any migration.
SELECT u.id,u.role,u.parent_user_id,p.role AS parent_role FROM app_users u LEFT JOIN app_users p ON p.id=u.parent_user_id WHERE (u.role = 'Sub-reseller' AND (p.id IS NULL OR p.role <> 'Reseller')) OR (u.role = 'Reseller' AND u.parent_user_id IS NOT NULL AND (p.id IS NULL OR p.role <> 'Admin'));
