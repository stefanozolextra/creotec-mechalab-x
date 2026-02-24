\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

SELECT 'Role distribution' AS section;
SELECT role, COUNT(*)::INT AS count
FROM accounts
GROUP BY role
ORDER BY role;

SELECT 'Admin/protected accounts' AS section;
SELECT
  login_email,
  role,
  is_system_protected,
  trainee_id,
  COALESCE(substring(password_hash FROM 1 FOR 4), '(null)') AS password_hash_prefix
FROM accounts
WHERE role = 'admin' OR is_system_protected = TRUE
ORDER BY login_email;

DO $$
DECLARE
  invalid_link_count INT;
  admin_or_protected_count INT;
  admin_or_protected_with_trainee_link_count INT;
  admin_or_protected_bad_hash_count INT;
BEGIN
  SELECT COUNT(*)::INT
  INTO invalid_link_count
  FROM accounts
  WHERE (role = 'admin' AND trainee_id IS NOT NULL)
     OR (role = 'trainee' AND trainee_id IS NULL);

  IF invalid_link_count > 0 THEN
    RAISE EXCEPTION
      'Sanity check failed: % account row(s) violate role/trainee linkage rules.',
      invalid_link_count;
  END IF;

  SELECT COUNT(*)::INT
  INTO admin_or_protected_count
  FROM accounts
  WHERE role = 'admin' OR is_system_protected = TRUE;

  IF admin_or_protected_count = 0 THEN
    RAISE EXCEPTION
      'Sanity check failed: no admin/protected account exists.';
  END IF;

  SELECT COUNT(*)::INT
  INTO admin_or_protected_with_trainee_link_count
  FROM accounts
  WHERE (role = 'admin' OR is_system_protected = TRUE)
    AND trainee_id IS NOT NULL;

  IF admin_or_protected_with_trainee_link_count > 0 THEN
    RAISE EXCEPTION
      'Sanity check failed: % admin/protected account(s) are linked to trainee_id.',
      admin_or_protected_with_trainee_link_count;
  END IF;

  SELECT COUNT(*)::INT
  INTO admin_or_protected_bad_hash_count
  FROM accounts
  WHERE (role = 'admin' OR is_system_protected = TRUE)
    AND (password_hash IS NULL OR left(password_hash, 4) NOT IN ('$2a$', '$2b$', '$2y$'));

  IF admin_or_protected_bad_hash_count > 0 THEN
    RAISE EXCEPTION
      'Sanity check failed: % admin/protected account(s) do not have bcrypt-like hash prefix.',
      admin_or_protected_bad_hash_count;
  END IF;

  RAISE NOTICE 'Sanity checks PASSED.';
END $$;

COMMIT;
