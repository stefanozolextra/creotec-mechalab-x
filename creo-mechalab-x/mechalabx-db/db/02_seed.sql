-- =========================
-- PRODUCTION-SAFE CURRICULUM BASELINE
-- Safe for manual Supabase apply.
-- No demo users, known password hashes, fake progress, or placeholder lesson URLs.
-- =========================

BEGIN;

-- Base learning structure. Add real lesson resources separately through admin
-- flows or SQL once production PDF/video URLs are ready.
INSERT INTO modules (module_code, title, description, order_no)
VALUES
  ('M01', 'Module 01 - Introduction', 'Overview of the system and basics.', 1),
  ('M02', 'Module 02 - Safety & Guidelines', 'Safety rules and policies.', 2),
  ('M03', 'Module 03 - Core Process', 'Step-by-step main process.', 3),
  ('M04', 'Module 04 - Advanced Tasks', 'Advanced workflow scenarios.', 4),
  ('M05', 'Module 05 - Troubleshooting', 'Common issues and solutions.', 5),
  ('M06', 'Module 06 - Basic PLC', 'Basic PLC trainer wiring and activity exercises.', 6)
ON CONFLICT (module_code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  order_no = EXCLUDED.order_no,
  is_active = TRUE;

-- Simulations
-- - M01 exposes the active default runtime pack routes 1..5
-- - M05 exposes the active electropneumatics runtime pack routes 5.1..5.5
-- - Other seeded modules keep 2 compatibility rows that still launch the default runtime pack
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
  ON runtime_module.module_code = manifest.runtime_module_code
ON CONFLICT (module_id, simulation_code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  order_no = EXCLUDED.order_no,
  route_id = EXCLUDED.route_id,
  runtime_module_id = EXCLUDED.runtime_module_id,
  is_required = EXCLUDED.is_required;

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
WHERE m.module_code NOT IN ('M01', 'M05', 'M06')
ON CONFLICT (module_id, simulation_code) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  order_no = EXCLUDED.order_no,
  route_id = EXCLUDED.route_id,
  runtime_module_id = EXCLUDED.runtime_module_id,
  is_required = EXCLUDED.is_required;

COMMIT;
