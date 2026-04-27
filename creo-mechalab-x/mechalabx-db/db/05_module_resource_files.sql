-- =========================
-- PHASE 5: MODULE RESOURCE FILE METADATA
-- =========================

BEGIN;

CREATE TABLE IF NOT EXISTS module_resource_files (
  file_id            BIGSERIAL PRIMARY KEY,
  resource_id        BIGINT NOT NULL UNIQUE REFERENCES module_resources(resource_id) ON DELETE CASCADE,
  storage_key        TEXT NOT NULL UNIQUE,
  original_filename  TEXT NOT NULL,
  mime_type          VARCHAR(120) NOT NULL,
  file_size          BIGINT NOT NULL CHECK (file_size > 0),
  sha256             CHAR(64),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_resource_files_created_at
  ON module_resource_files (created_at DESC);

COMMIT;
