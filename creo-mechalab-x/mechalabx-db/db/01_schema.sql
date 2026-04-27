-- =========================
-- CORE TABLES (Trainees + Accounts)
-- =========================

CREATE TABLE batches (
  batch_id      BIGSERIAL PRIMARY KEY,
  batch_code    VARCHAR(30) UNIQUE NOT NULL,
  description   TEXT,
  start_date    DATE,
  end_date      DATE
);

CREATE TABLE trainees (
  trainee_id      BIGSERIAL PRIMARY KEY,
  batch_id        BIGINT NOT NULL REFERENCES batches(batch_id),
  trainee_code    VARCHAR(40) UNIQUE NOT NULL,

  first_name      VARCHAR(60) NOT NULL,
  middle_name     VARCHAR(60),
  last_name       VARCHAR(60) NOT NULL,

  email           VARCHAR(120) UNIQUE NOT NULL,
  contact_number  VARCHAR(30),
  address         TEXT,
  birth_date      DATE,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
  account_id     BIGSERIAL PRIMARY KEY,
  trainee_id     BIGINT UNIQUE NOT NULL REFERENCES trainees(trainee_id) ON DELETE CASCADE,
  login_email    VARCHAR(120) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  access_mode    VARCHAR(30) NOT NULL DEFAULT 'standard' CHECK (access_mode IN ('standard', 'lesson_only')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- MODULE FLOW (6 modules, resources, simulations, progress)
-- =========================

CREATE TABLE modules (
  module_id   BIGSERIAL PRIMARY KEY,
  module_code VARCHAR(20) UNIQUE NOT NULL,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  order_no    INT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE module_resources (
  resource_id BIGSERIAL PRIMARY KEY,
  module_id   BIGINT NOT NULL REFERENCES modules(module_id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('PDF','VIDEO')),
  title       VARCHAR(150) NOT NULL,
  url         TEXT NOT NULL,
  order_no    INT NOT NULL
);

-- Metadata for managed resource files (used for uploaded lesson PDFs).
CREATE TABLE module_resource_files (
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

CREATE TABLE simulations (
  simulation_id   BIGSERIAL PRIMARY KEY,
  module_id       BIGINT REFERENCES modules(module_id) ON DELETE CASCADE,
  simulation_code VARCHAR(30) NOT NULL,
  title           VARCHAR(150) NOT NULL,
  description     TEXT,
  order_no        INT NOT NULL,
  route_id        TEXT,
  runtime_module_id BIGINT REFERENCES modules(module_id),
  is_required     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (module_id, simulation_code)
);

CREATE TABLE trainee_simulation_progress (
  trainee_id      BIGINT NOT NULL REFERENCES trainees(trainee_id) ON DELETE CASCADE,
  simulation_id   BIGINT NOT NULL REFERENCES simulations(simulation_id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED')),
  best_score      INT,
  attempts_count  INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  last_accessed_at TIMESTAMP,
  PRIMARY KEY (trainee_id, simulation_id)
);

-- Quiz tables are defined in 06_quizzes.sql so fresh Docker init and manual
-- incremental apply both use the same phase-specific DDL.

-- Helpful indexes
CREATE INDEX idx_trainees_batch_id ON trainees(batch_id);
CREATE INDEX idx_resources_module_id ON module_resources(module_id);
CREATE INDEX idx_module_resource_files_created_at ON module_resource_files(created_at DESC);
CREATE INDEX idx_sims_module_id ON simulations(module_id);

-- =========================
-- OPTION A: COMPUTE MODULE COMPLETION (VIEW)
-- Bootstrap view: 06_quizzes.sql replaces this with the final quiz-aware
-- module completion logic once quiz tables exist.
-- =========================

CREATE OR REPLACE VIEW v_trainee_module_status AS
SELECT
  t.trainee_id,
  m.module_id,
  m.module_code,
  m.title AS module_title,
  COUNT(CASE WHEN s.is_required THEN 1 END) AS required_sims,
  COUNT(CASE WHEN s.is_required AND tsp.status = 'COMPLETED' THEN 1 END) AS completed_required_sims,
  CASE
    WHEN COUNT(CASE WHEN s.is_required THEN 1 END) = 0 THEN 'COMPLETED'
    WHEN COUNT(CASE WHEN s.is_required AND tsp.status = 'COMPLETED' THEN 1 END)
         = COUNT(CASE WHEN s.is_required THEN 1 END)
      THEN 'COMPLETED'
    WHEN COUNT(CASE WHEN tsp.status IN ('IN_PROGRESS','COMPLETED') THEN 1 END) > 0
      THEN 'IN_PROGRESS'
    ELSE 'NOT_STARTED'
  END AS module_status
FROM trainees t
CROSS JOIN modules m
LEFT JOIN simulations s ON s.module_id = m.module_id
LEFT JOIN trainee_simulation_progress tsp
  ON tsp.trainee_id = t.trainee_id
 AND tsp.simulation_id = s.simulation_id
GROUP BY t.trainee_id, m.module_id, m.module_code, m.title;
