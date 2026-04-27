-- =========================
-- PHASE 6: QUIZ FOUNDATIONS + ADMIN MANAGEMENT SUPPORT
--
-- Existing databases can apply this manually with:
-- psql "$DATABASE_URL" -f "mechalabx-db/db/06_quizzes.sql"
-- =========================

BEGIN;

CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id                 BIGSERIAL PRIMARY KEY,
  module_id               BIGINT NOT NULL REFERENCES modules(module_id),
  cloned_from_quiz_id     BIGINT REFERENCES quizzes(quiz_id) ON DELETE SET NULL,
  title                   VARCHAR(150) NOT NULL CHECK (BTRIM(title) <> ''),
  passing_score_percent   INT NOT NULL DEFAULT 75 CHECK (passing_score_percent = 75),
  max_attempts            INT NOT NULL CHECK (max_attempts > 0),
  time_limit_minutes      INT NOT NULL CHECK (time_limit_minutes > 0),
  status                  VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at            TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status <> 'published' OR published_at IS NOT NULL)
    AND
    (status <> 'archived' OR archived_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  question_id    BIGSERIAL PRIMARY KEY,
  quiz_id        BIGINT NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL CHECK (BTRIM(question_text) <> ''),
  order_no       INT NOT NULL CHECK (order_no > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, order_no)
);

CREATE TABLE IF NOT EXISTS quiz_choices (
  choice_id      BIGSERIAL PRIMARY KEY,
  question_id    BIGINT NOT NULL REFERENCES quiz_questions(question_id) ON DELETE CASCADE,
  choice_no      SMALLINT NOT NULL CHECK (choice_no BETWEEN 1 AND 4),
  choice_text    TEXT NOT NULL CHECK (BTRIM(choice_text) <> ''),
  is_correct     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, choice_no)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  attempt_id           BIGSERIAL PRIMARY KEY,
  quiz_id              BIGINT NOT NULL REFERENCES quizzes(quiz_id),
  trainee_id           BIGINT NOT NULL REFERENCES trainees(trainee_id) ON DELETE CASCADE,
  attempt_no           INT NOT NULL CHECK (attempt_no > 0),
  status               VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  score_percent        NUMERIC(5,2),
  passed               BOOLEAN,
  time_limit_seconds   INT NOT NULL CHECK (time_limit_seconds > 0),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, trainee_id, attempt_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_choices_question_choice
  ON quiz_choices(question_id, choice_id);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  attempt_id           BIGINT NOT NULL REFERENCES quiz_attempts(attempt_id) ON DELETE CASCADE,
  question_id          BIGINT NOT NULL REFERENCES quiz_questions(question_id),
  selected_choice_id   BIGINT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id),
  CONSTRAINT quiz_attempt_answers_selected_choice_fk
    FOREIGN KEY (question_id, selected_choice_id)
    REFERENCES quiz_choices(question_id, choice_id)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_module_id
  ON quizzes(module_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_status_module_id
  ON quizzes(status, module_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quizzes_one_published_per_module
  ON quizzes(module_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id
  ON quiz_questions(quiz_id, order_no);

CREATE INDEX IF NOT EXISTS idx_quiz_choices_question_id
  ON quiz_choices(question_id, choice_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_choices_one_correct_per_question
  ON quiz_choices(question_id)
  WHERE is_correct = TRUE;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id
  ON quiz_attempts(quiz_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_trainee_id
  ON quiz_attempts(trainee_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_one_in_progress_per_quiz_trainee
  ON quiz_attempts(quiz_id, trainee_id)
  WHERE status = 'in_progress';

-- Refresh the shared module-status view now that quiz tables exist.
-- Standard trainees must finish required simulations and pass the module quiz
-- when a published quiz is assigned. Lesson-only trainees keep the previous
-- simulation-only semantics so existing reporting behavior is preserved.
--
-- Repo-fit archived quiz rule:
-- A passed attempt on any module-linked quiz version that was published at
-- some point (currently published or later archived) continues to satisfy the
-- quiz requirement. This avoids retroactively stripping completion when admins
-- archive and replace a quiz version.
CREATE OR REPLACE VIEW v_trainee_module_status AS
WITH module_simulation_progress AS (
  SELECT
    t.trainee_id,
    m.module_id,
    m.module_code,
    m.title AS module_title,
    COALESCE(a.access_mode, 'standard') AS access_mode,
    COUNT(CASE WHEN s.is_required THEN 1 END) AS required_sims,
    COUNT(CASE WHEN s.is_required AND tsp.status = 'COMPLETED' THEN 1 END) AS completed_required_sims,
    COUNT(CASE WHEN tsp.status IN ('IN_PROGRESS','COMPLETED') THEN 1 END) AS started_sim_count
  FROM trainees t
  LEFT JOIN accounts a ON a.trainee_id = t.trainee_id
  CROSS JOIN modules m
  LEFT JOIN simulations s ON s.module_id = m.module_id
  LEFT JOIN trainee_simulation_progress tsp
    ON tsp.trainee_id = t.trainee_id
   AND tsp.simulation_id = s.simulation_id
  GROUP BY
    t.trainee_id,
    m.module_id,
    m.module_code,
    m.title,
    COALESCE(a.access_mode, 'standard')
),
published_module_quizzes AS (
  SELECT
    q.module_id,
    COUNT(*) FILTER (WHERE q.status = 'published') > 0 AS quiz_required
  FROM quizzes q
  GROUP BY q.module_id
),
trainee_module_quiz_progress AS (
  SELECT
    qa.trainee_id,
    q.module_id,
    COUNT(*) FILTER (WHERE q.status IN ('published', 'archived')) AS quiz_attempt_count,
    BOOL_OR(
      qa.passed = TRUE
      AND qa.status IN ('submitted', 'expired')
      AND q.status IN ('published', 'archived')
    ) AS quiz_passed
  FROM quiz_attempts qa
  JOIN quizzes q ON q.quiz_id = qa.quiz_id
  GROUP BY qa.trainee_id, q.module_id
)
SELECT
  msp.trainee_id,
  msp.module_id,
  msp.module_code,
  msp.module_title,
  msp.required_sims,
  msp.completed_required_sims,
  CASE
    WHEN msp.access_mode = 'lesson_only' THEN
      CASE
        WHEN msp.required_sims = 0 THEN 'COMPLETED'
        WHEN msp.completed_required_sims = msp.required_sims THEN 'COMPLETED'
        WHEN msp.started_sim_count > 0 THEN 'IN_PROGRESS'
        ELSE 'NOT_STARTED'
      END
    WHEN msp.completed_required_sims = msp.required_sims
         AND (
           COALESCE(pmq.quiz_required, FALSE) = FALSE
           OR COALESCE(tmqp.quiz_passed, FALSE) = TRUE
         )
      THEN 'COMPLETED'
    WHEN msp.started_sim_count > 0
         OR COALESCE(tmqp.quiz_attempt_count, 0) > 0
      THEN 'IN_PROGRESS'
    ELSE 'NOT_STARTED'
  END AS module_status
FROM module_simulation_progress msp
LEFT JOIN published_module_quizzes pmq
  ON pmq.module_id = msp.module_id
LEFT JOIN trainee_module_quiz_progress tmqp
  ON tmqp.trainee_id = msp.trainee_id
 AND tmqp.module_id = msp.module_id;

COMMIT;
