-- =========================
-- PHASE 2: RESET AUDIT + EXPORT LOG
-- =========================

BEGIN;

CREATE TABLE IF NOT EXISTS batch_exports (
  batch_export_id BIGSERIAL PRIMARY KEY,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_by_account_id BIGINT NOT NULL REFERENCES accounts(account_id),
  batch_code VARCHAR(30) NOT NULL,
  rows_exported INT NOT NULL DEFAULT 0,
  file_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_exports_batch_code_exported_at
  ON batch_exports (batch_code, exported_at DESC);

CREATE TABLE IF NOT EXISTS system_resets (
  reset_id BIGSERIAL PRIMARY KEY,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_by_account_id BIGINT NOT NULL REFERENCES accounts(account_id),
  batch_code VARCHAR(30) NOT NULL,
  deleted_progress_rows INT NOT NULL,
  deleted_trainee_accounts INT NOT NULL,
  deleted_trainees INT NOT NULL,
  deleted_batches INT NOT NULL,
  forced BOOLEAN NOT NULL DEFAULT FALSE
);

COMMIT;
