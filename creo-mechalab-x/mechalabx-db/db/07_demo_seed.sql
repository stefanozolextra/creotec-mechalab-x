-- =========================
-- DEV / DEMO ONLY
-- Seeds demo batches, trainees, known-password accounts, placeholder lesson
-- URLs, and fake progress for local development.
-- Do not apply this file to production Supabase databases.
-- =========================

BEGIN;

-- Batches
INSERT INTO batches (batch_code, description, start_date, end_date)
VALUES
  ('2026-IMM01', 'Work Immersion Batch 1', '2026-02-09', '2026-04-30'),
  ('2026-IMM02', 'Work Immersion Batch 2', '2026-03-02', '2026-05-20')
ON CONFLICT (batch_code) DO UPDATE
SET
  description = EXCLUDED.description,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date;

-- 25 trainees (15 in batch1, 10 in batch2)
WITH batch_ids AS (
  SELECT
    MAX(CASE WHEN batch_code = '2026-IMM01' THEN batch_id END) AS batch1_id,
    MAX(CASE WHEN batch_code = '2026-IMM02' THEN batch_id END) AS batch2_id
  FROM batches
)
INSERT INTO trainees (
  batch_id,
  trainee_code,
  first_name,
  middle_name,
  last_name,
  email,
  contact_number,
  address,
  birth_date
)
SELECT
  CASE WHEN gs <= 15 THEN batch_ids.batch1_id ELSE batch_ids.batch2_id END AS batch_id,
  (CASE WHEN gs <= 15 THEN '2026-IMM01-' ELSE '2026-IMM02-' END) || LPAD((CASE WHEN gs <= 15 THEN gs ELSE gs - 15 END)::TEXT, 4, '0') AS trainee_code,
  'Trainee' || LPAD(gs::TEXT, 2, '0') AS first_name,
  'M' AS middle_name,
  'Demo' AS last_name,
  'trainee' || LPAD(gs::TEXT, 2, '0') || '@demo.local' AS email,
  '09' || LPAD((900000000 + gs)::TEXT, 9, '0') AS contact_number,
  'Binan, Laguna, Philippines' AS address,
  DATE '2004-01-01' + (gs * 30) AS birth_date
FROM generate_series(1, 25) gs
CROSS JOIN batch_ids
ON CONFLICT (trainee_code) DO UPDATE
SET
  batch_id = EXCLUDED.batch_id,
  first_name = EXCLUDED.first_name,
  middle_name = EXCLUDED.middle_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  contact_number = EXCLUDED.contact_number,
  address = EXCLUDED.address,
  birth_date = EXCLUDED.birth_date;

-- Accounts (same dev password hash for all)
-- Password (for dev): P@ssw0rd!
INSERT INTO accounts (trainee_id, login_email, password_hash)
SELECT
  trainee_id,
  email,
  '$2b$10$AtjhTJ8XjKO/PJHy3pfkBOIASTsUOD6WVj7af0nR4keZKcg2fRzKm'
FROM trainees
WHERE email ~ '^trainee[0-9]{2}@demo\.local$'
ON CONFLICT (login_email) DO UPDATE
SET
  trainee_id = EXCLUDED.trainee_id,
  password_hash = EXCLUDED.password_hash,
  role = 'trainee',
  access_mode = 'standard',
  is_active = TRUE,
  is_system_protected = FALSE;

-- Demo admin for local-only bootstrap and smoke testing.
INSERT INTO accounts (trainee_id, login_email, password_hash, is_active, role, access_mode, is_system_protected)
VALUES (
  NULL,
  'admin@demo.local',
  '$2b$10$AtjhTJ8XjKO/PJHy3pfkBOIASTsUOD6WVj7af0nR4keZKcg2fRzKm',
  TRUE,
  'admin',
  'standard',
  TRUE
)
ON CONFLICT (login_email) DO UPDATE
SET
  trainee_id = NULL,
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE,
  role = 'admin',
  access_mode = 'standard',
  is_system_protected = TRUE;

-- Placeholder lesson/video resources for local demo use only.
INSERT INTO module_resources (module_id, type, title, url, order_no)
SELECT
  m.module_id,
  'PDF',
  m.module_code || ' PDF Lesson',
  'https://example.com/' || lower(m.module_code) || '/lesson.pdf',
  1
FROM modules m
WHERE NOT EXISTS (
  SELECT 1
  FROM module_resources existing
  WHERE existing.module_id = m.module_id
    AND existing.type = 'PDF'
    AND existing.order_no = 1
);

INSERT INTO module_resources (module_id, type, title, url, order_no)
SELECT
  m.module_id,
  'VIDEO',
  m.module_code || ' Video Lesson',
  'https://example.com/' || lower(m.module_code) || '/video.mp4',
  2
FROM modules m
WHERE NOT EXISTS (
  SELECT 1
  FROM module_resources existing
  WHERE existing.module_id = m.module_id
    AND existing.type = 'VIDEO'
    AND existing.order_no = 2
);

-- Deterministic realistic demo progress distribution
WITH demo_trainees AS (
  SELECT
    trainee_id,
    CAST(substring(email FROM 'trainee([0-9]{2})@demo\.local') AS INT) AS demo_no
  FROM trainees
  WHERE email ~ '^trainee[0-9]{2}@demo\.local$'
)
INSERT INTO trainee_simulation_progress
  (trainee_id, simulation_id, status, best_score, attempts_count, started_at, completed_at, last_accessed_at)
SELECT
  t.trainee_id,
  s.simulation_id,
  CASE
    WHEN t.demo_no BETWEEN 1 AND 6 THEN 'COMPLETED'
    WHEN t.demo_no BETWEEN 7 AND 12 AND m.order_no <= 3 THEN 'COMPLETED'
    WHEN t.demo_no BETWEEN 7 AND 12 AND m.order_no = 4 THEN 'IN_PROGRESS'
    WHEN t.demo_no BETWEEN 13 AND 18 AND m.order_no = 1 THEN 'COMPLETED'
    WHEN t.demo_no BETWEEN 13 AND 18 AND m.order_no = 2 THEN 'IN_PROGRESS'
    ELSE 'NOT_STARTED'
  END AS status,
  CASE
    WHEN t.demo_no BETWEEN 1 AND 12 AND m.order_no <= 3 THEN 85
    WHEN t.demo_no BETWEEN 1 AND 6 THEN 92
    WHEN t.demo_no BETWEEN 13 AND 18 AND m.order_no = 1 THEN 80
    ELSE NULL
  END AS best_score,
  CASE
    WHEN t.demo_no BETWEEN 1 AND 6 THEN 2
    WHEN t.demo_no BETWEEN 7 AND 12 AND m.order_no <= 4 THEN 1
    WHEN t.demo_no BETWEEN 13 AND 18 AND m.order_no <= 2 THEN 1
    ELSE 0
  END AS attempts_count,
  CASE
    WHEN t.demo_no BETWEEN 1 AND 18 THEN NOW() - INTERVAL '10 days'
    ELSE NULL
  END AS started_at,
  CASE
    WHEN (t.demo_no BETWEEN 1 AND 6)
      OR (t.demo_no BETWEEN 7 AND 12 AND m.order_no <= 3)
      OR (t.demo_no BETWEEN 13 AND 18 AND m.order_no = 1)
    THEN NOW() - INTERVAL '3 days'
    ELSE NULL
  END AS completed_at,
  CASE
    WHEN t.demo_no BETWEEN 1 AND 18 THEN NOW() - INTERVAL '1 day'
    ELSE NULL
  END AS last_accessed_at
FROM demo_trainees t
CROSS JOIN simulations s
JOIN modules m ON m.module_id = s.module_id
WHERE t.demo_no BETWEEN 1 AND 18
ON CONFLICT (trainee_id, simulation_id) DO UPDATE
SET
  status = EXCLUDED.status,
  best_score = EXCLUDED.best_score,
  attempts_count = EXCLUDED.attempts_count,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  last_accessed_at = EXCLUDED.last_accessed_at;

COMMIT;
