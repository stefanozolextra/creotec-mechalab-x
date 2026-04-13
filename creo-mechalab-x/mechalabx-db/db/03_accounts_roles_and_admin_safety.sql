-- =========================
-- PHASE 1: ACCOUNT ROLE SAFETY FOUNDATIONS
-- =========================

BEGIN;

-- 1) Add DB-authoritative role and protection fields.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE accounts
SET role = 'trainee'
WHERE role IS NULL;

ALTER TABLE accounts
  ALTER COLUMN role SET DEFAULT 'trainee',
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS access_mode TEXT;

UPDATE accounts
SET access_mode = 'standard'
WHERE access_mode IS NULL;

ALTER TABLE accounts
  ALTER COLUMN access_mode SET DEFAULT 'standard',
  ALTER COLUMN access_mode SET NOT NULL;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS is_system_protected BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Allow standalone admin accounts (not linked to trainees).
ALTER TABLE accounts
  ALTER COLUMN trainee_id DROP NOT NULL;

-- Normalize existing role-to-linkage shape before adding role linkage constraints.
UPDATE accounts
SET trainee_id = NULL
WHERE role = 'admin';

-- 3) Add initial email audit timestamp placeholder.
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS initial_password_sent_at TIMESTAMPTZ NULL;

-- 4) Constraints for role integrity and account linkage integrity.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_role_check'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_role_check
      CHECK (role IN ('admin', 'trainee'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_access_mode_check'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_access_mode_check
      CHECK (access_mode IN ('standard', 'lesson_only'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_role_trainee_link_check'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_role_trainee_link_check
      CHECK (
        (role = 'trainee' AND trainee_id IS NOT NULL)
        OR
        (role = 'admin' AND trainee_id IS NULL)
      );
  END IF;
END $$;

-- 5) Ensure existing admin rows are protected.
UPDATE accounts
SET is_system_protected = TRUE
WHERE role = 'admin';

-- 6) Bootstrap one protected admin if no admin/protected account exists.
INSERT INTO accounts (trainee_id, login_email, password_hash, is_active, role, is_system_protected)
SELECT
  NULL,
  'admin@demo.local',
  '$2b$10$AtjhTJ8XjKO/PJHy3pfkBOIASTsUOD6WVj7af0nR4keZKcg2fRzKm',
  TRUE,
  'admin',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM accounts
  WHERE role = 'admin' OR is_system_protected = TRUE
);

COMMIT;
