-- =========================
-- BATCHES
-- =========================
INSERT INTO batches (batch_code, description, start_date, end_date)
VALUES
('2026-IMM01', 'Work Immersion Batch 1', '2026-02-09', '2026-04-30'),
('2026-IMM02', 'Work Immersion Batch 2', '2026-03-02', '2026-05-20');

-- =========================
-- 25 TRAINEES (15 in batch1, 10 in batch2)
-- trainee_code format: {batch_code}-{0001..}
-- =========================
INSERT INTO trainees (batch_id, trainee_code, first_name, middle_name, last_name, email, contact_number, address, birth_date)
SELECT
  CASE WHEN gs <= 15 THEN 1 ELSE 2 END AS batch_id,
  (CASE WHEN gs <= 15 THEN '2026-IMM01-' ELSE '2026-IMM02-' END) || LPAD((CASE WHEN gs <= 15 THEN gs ELSE gs-15 END)::text, 4, '0') AS trainee_code,
  'Trainee' || LPAD(gs::text, 2, '0') AS first_name,
  'M' AS middle_name,
  'Demo' AS last_name,
  'trainee' || LPAD(gs::text, 2, '0') || '@demo.local' AS email,
  '09' || LPAD((900000000 + gs)::text, 9, '0') AS contact_number,
  'Biñan, Laguna, Philippines' AS address,
  DATE '2004-01-01' + (gs * 30) AS birth_date
FROM generate_series(1,25) gs;

-- =========================
-- ACCOUNTS (same dev password hash for all)
-- Password (for dev): P@ssw0rd!
-- bcrypt hash below is valid bcrypt.
-- =========================
INSERT INTO accounts (trainee_id, login_email, password_hash)
SELECT
  trainee_id,
  email,
  '$2b$10$AtjhTJ8XjKO/PJHy3pfkBOIASTsUOD6WVj7af0nR4keZKcg2fRzKm'
FROM trainees;

-- =========================
-- 6 MODULES
-- =========================
INSERT INTO modules (module_code, title, description, order_no)
VALUES
('M01', 'Module 01 - Introduction', 'Overview of the system and basics.', 1),
('M02', 'Module 02 - Safety & Guidelines', 'Safety rules and policies.', 2),
('M03', 'Module 03 - Core Process', 'Step-by-step main process.', 3),
('M04', 'Module 04 - Advanced Tasks', 'Advanced workflow scenarios.', 4),
('M05', 'Module 05 - Troubleshooting', 'Common issues and solutions.', 5),
('M06', 'Module 06 - Basic PLC', 'Basic PLC trainer wiring and activity exercises.', 6);

-- =========================
-- RESOURCES: PDF + VIDEO per module
-- =========================
INSERT INTO module_resources (module_id, type, title, url, order_no)
SELECT m.module_id, 'PDF', m.module_code || ' PDF Lesson',
       'https://example.com/' || lower(m.module_code) || '/lesson.pdf', 1
FROM modules m;

INSERT INTO module_resources (module_id, type, title, url, order_no)
SELECT m.module_id, 'VIDEO', m.module_code || ' Video Lesson',
       'https://example.com/' || lower(m.module_code) || '/video.mp4', 2
FROM modules m;

-- =========================
-- SIMULATIONS
-- - M01 exposes the active default runtime pack routes 1..5
-- - M05 exposes the active electropneumatics runtime pack routes 5.1..5.5
-- - Other seeded modules keep 2 compatibility rows that still launch the default runtime pack
-- =========================
INSERT INTO simulations (module_id, simulation_code, title, description, order_no, route_id, runtime_module_id, is_required)
SELECT
  m.module_id,
  manifest.simulation_code,
  manifest.title,
  manifest.description,
  manifest.order_no,
  manifest.route_id,
  runtime_module.module_id,
  TRUE
FROM modules m
JOIN (
  VALUES
    ('M01', 'ACT-1', 'Start-Stop Control Unit', 'Runtime activity 1: Start-Stop Control Unit', 1, '1', 'M01'),
    ('M01', 'ACT-2', 'Start-Stop Latching Conrtol Unit', 'Runtime activity 2: Start-Stop Latching Conrtol Unit', 2, '2', 'M01'),
    ('M01', 'ACT-3', 'Series Start', 'Runtime activity 3: Series Start', 3, '3', 'M01'),
    ('M01', 'ACT-4', 'Parallel Start', 'Runtime activity 4: Parallel Start', 4, '4', 'M01'),
    ('M01', 'ACT-5', 'On-Delay Timer Circuit', 'Runtime activity 5: On-Delay Timer Circuit', 5, '5', 'M01'),
    ('M05', 'ACT-5.1', 'Start - Stop Electropneumatics Control', 'Runtime activity 5.1: Start - Stop Electropneumatics Control', 1, '5.1', 'M05'),
    ('M05', 'ACT-5.2', 'A+ A-', 'Runtime activity 5.2: A+ A-', 2, '5.2', 'M05'),
    ('M05', 'ACT-5.3', 'A+ B+ A- B-', 'Runtime activity 5.3: A+ B+ A- B-', 3, '5.3', 'M05'),
    ('M05', 'ACT-5.4', 'A+ B+ B- A-', 'Runtime activity 5.4: A+ B+ B- A-', 4, '5.4', 'M05'),
    ('M05', 'ACT-5.5', 'A+ A- B+ B-', 'Runtime activity 5.5: A+ A- B+ B-', 5, '5.5', 'M05'),
    ('M06', 'ACT-6.1', 'PLC Buzzer Basic Wiring', 'Runtime activity 6.1: PLC Buzzer Basic Wiring', 1, '6.1', 'M06'),
    ('M06', 'ACT-6.2', 'PLC Activity 2: PLC Input and Output Wiring', 'Runtime activity 6.2: PLC Input and Output Wiring', 2, '6.2', 'M06'),
    ('M06', 'ACT-6.3', 'PLC Activity 3: PLC Motor Control', 'Runtime activity 6.3: PLC Motor Control', 3, '6.3', 'M06'),
    ('M06', 'ACT-6.4', 'PLC Activity 4: PLC Sensor Control', 'Runtime activity 6.4: PLC Sensor Control', 4, '6.4', 'M06'),
    ('M06', 'ACT-6.5', 'PLC Activity 5: PLC Sequence Control', 'Runtime activity 6.5: PLC Sequence Control', 5, '6.5', 'M06')
) AS manifest(owner_module_code, simulation_code, title, description, order_no, route_id, runtime_module_code)
  ON manifest.owner_module_code = m.module_code
JOIN modules runtime_module
  ON runtime_module.module_code = manifest.runtime_module_code;

INSERT INTO simulations (module_id, simulation_code, title, description, order_no, route_id, runtime_module_id, is_required)
SELECT
  m.module_id,
  fallback.simulation_code,
  fallback.title,
  fallback.description,
  fallback.order_no,
  fallback.route_id,
  runtime_default.module_id,
  TRUE
FROM modules m
JOIN (
  VALUES
    ('ACT-1', 'Start-Stop Control Unit', 'Runtime activity 1: Start-Stop Control Unit', 1, '1'),
    ('ACT-2', 'Start-Stop Latching Conrtol Unit', 'Runtime activity 2: Start-Stop Latching Conrtol Unit', 2, '2')
) AS fallback(simulation_code, title, description, order_no, route_id)
  ON TRUE
JOIN modules runtime_default
  ON runtime_default.module_code = 'M01'
WHERE m.module_code NOT IN ('M01', 'M05', 'M06');

-- =========================
-- TRAINEE SIMULATION PROGRESS (deterministic realistic distribution)
-- Rules:
-- - Trainee 1-6: completed all sims (all modules completed)
-- - Trainee 7-12: completed modules 1-3 sims, module 4 in progress, rest not started
-- - Trainee 13-18: module 1 completed, module 2 in progress, rest not started
-- - Trainee 19-25: not started anything
-- =========================
INSERT INTO trainee_simulation_progress
(trainee_id, simulation_id, status, best_score, attempts_count, started_at, completed_at, last_accessed_at)
SELECT
  t.trainee_id,
  s.simulation_id,
  CASE
    WHEN t.trainee_id BETWEEN 1 AND 6 THEN 'COMPLETED'
    WHEN t.trainee_id BETWEEN 7 AND 12 AND m.order_no <= 3 THEN 'COMPLETED'
    WHEN t.trainee_id BETWEEN 7 AND 12 AND m.order_no = 4 THEN 'IN_PROGRESS'
    WHEN t.trainee_id BETWEEN 13 AND 18 AND m.order_no = 1 THEN 'COMPLETED'
    WHEN t.trainee_id BETWEEN 13 AND 18 AND m.order_no = 2 THEN 'IN_PROGRESS'
    ELSE 'NOT_STARTED'
  END AS status,
  CASE
    WHEN t.trainee_id BETWEEN 1 AND 12 AND m.order_no <= 3 THEN 85
    WHEN t.trainee_id BETWEEN 1 AND 6 THEN 92
    WHEN t.trainee_id BETWEEN 13 AND 18 AND m.order_no = 1 THEN 80
    ELSE NULL
  END AS best_score,
  CASE
    WHEN t.trainee_id BETWEEN 1 AND 6 THEN 2
    WHEN t.trainee_id BETWEEN 7 AND 12 AND m.order_no <= 4 THEN 1
    WHEN t.trainee_id BETWEEN 13 AND 18 AND m.order_no <= 2 THEN 1
    ELSE 0
  END AS attempts_count,
  CASE
    WHEN t.trainee_id BETWEEN 1 AND 18 THEN NOW() - INTERVAL '10 days'
    ELSE NULL
  END AS started_at,
  CASE
    WHEN (t.trainee_id BETWEEN 1 AND 6)
      OR (t.trainee_id BETWEEN 7 AND 12 AND m.order_no <= 3)
      OR (t.trainee_id BETWEEN 13 AND 18 AND m.order_no = 1)
    THEN NOW() - INTERVAL '3 days'
    ELSE NULL
  END AS completed_at,
  CASE
    WHEN t.trainee_id BETWEEN 1 AND 18 THEN NOW() - INTERVAL '1 day'
    ELSE NULL
  END AS last_accessed_at
FROM trainees t
CROSS JOIN simulations s
JOIN modules m ON m.module_id = s.module_id
WHERE
  -- only insert rows for people who started anything (1-18)
  t.trainee_id BETWEEN 1 AND 18;
