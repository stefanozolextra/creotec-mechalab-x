require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

function parsePositiveIntParam(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

app.get("/api/health", async (req, res) => {
    try {
        const r = await pool.query("SELECT NOW() as now");
        res.json({ ok: true, now: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Modules + resources + simulations
app.get("/api/modules", async (req, res) => {
    try {
        const modules = await pool.query("SELECT * FROM modules ORDER BY order_no;");
        const resources = await pool.query("SELECT * FROM module_resources ORDER BY module_id, order_no;");
        const sims = await pool.query("SELECT * FROM simulations ORDER BY module_id, order_no;");
        res.json({ modules: modules.rows, resources: resources.rows, simulations: sims.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Computed module status for a trainee (Option A view)
app.get("/api/trainees/:traineeId/module-status", async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });

        const result = await pool.query(
            `SELECT module_id, module_code, module_title, required_sims, completed_required_sims, module_status
       FROM v_trainee_module_status
       WHERE trainee_id = $1
       ORDER BY module_id`,
            [traineeId]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/trainees", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        t.trainee_id,
        t.trainee_code,
        t.first_name,
        t.middle_name,
        t.last_name,
        t.email,
        t.contact_number,
        b.batch_code
      FROM trainees t
      JOIN batches b ON b.batch_id = t.batch_id
      ORDER BY t.trainee_id;
    `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/trainees/:traineeId/dashboard", async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });

        const profile = await pool.query(
            `SELECT t.trainee_id, t.trainee_code, t.first_name, t.middle_name, t.last_name,
            t.email, t.contact_number, t.address, t.birth_date, b.batch_code
     FROM trainees t
     JOIN batches b ON b.batch_id = t.batch_id
     WHERE t.trainee_id = $1`,
            [traineeId]
        );

        if (profile.rows.length === 0) return res.status(404).json({ error: "Trainee not found" });

        const [moduleStatus, modules, resources, simulations, simulationProgress] = await Promise.all([
            pool.query(
                `SELECT module_id, module_code, module_title, required_sims, completed_required_sims, module_status
         FROM v_trainee_module_status
         WHERE trainee_id = $1
         ORDER BY module_id`,
                [traineeId]
            ),
            pool.query("SELECT * FROM modules ORDER BY order_no"),
            pool.query("SELECT * FROM module_resources ORDER BY module_id, order_no"),
            pool.query("SELECT * FROM simulations ORDER BY module_id, order_no"),
            pool.query(
                `SELECT
           tsp.simulation_id,
           (tsp.status = 'COMPLETED') AS is_completed,
           tsp.best_score,
           tsp.completed_at,
           COALESCE(tsp.last_accessed_at, tsp.completed_at, tsp.started_at) AS updated_at
         FROM trainee_simulation_progress tsp
         JOIN simulations s ON s.simulation_id = tsp.simulation_id
         WHERE tsp.trainee_id = $1
         ORDER BY s.module_id, s.order_no, tsp.simulation_id`,
                [traineeId]
            ),
        ]);

        res.json({
            trainee: profile.rows[0],
            moduleStatus: moduleStatus.rows,
            moduleContent: {
                modules: modules.rows,
                resources: resources.rows,
                simulations: simulations.rows,
            },
            simulationProgress: simulationProgress.rows,
        });
    } catch (e) {
        console.error("Dashboard endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/api/trainees/:traineeId/simulations/:simulationId/complete", async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });

        const simulationId = parsePositiveIntParam(req.params.simulationId);
        if (!simulationId) return res.status(400).json({ error: "Invalid simulationId" });

        const rawBestScore = req.body?.bestScore;
        let bestScore = null;

        if (rawBestScore !== undefined && rawBestScore !== null) {
            const isValidScore =
                typeof rawBestScore === "number" && Number.isFinite(rawBestScore) && rawBestScore >= 0;

            if (!isValidScore) return res.status(400).json({ error: "Invalid bestScore" });
            bestScore = rawBestScore;
        }

        const [traineeExists, simulationExists] = await Promise.all([
            pool.query("SELECT 1 FROM trainees WHERE trainee_id = $1", [traineeId]),
            pool.query("SELECT 1 FROM simulations WHERE simulation_id = $1", [simulationId]),
        ]);

        if (traineeExists.rowCount === 0) return res.status(404).json({ error: "Trainee not found" });
        if (simulationExists.rowCount === 0) return res.status(404).json({ error: "Simulation not found" });

        await pool.query(
            `INSERT INTO trainee_simulation_progress
        (trainee_id, simulation_id, status, best_score, attempts_count, started_at, completed_at, last_accessed_at)
       VALUES ($1, $2, 'COMPLETED', $3, 1, NOW(), NOW(), NOW())
       ON CONFLICT (trainee_id, simulation_id)
       DO UPDATE SET
         status = 'COMPLETED',
         best_score = COALESCE(EXCLUDED.best_score, trainee_simulation_progress.best_score),
         attempts_count = trainee_simulation_progress.attempts_count + 1,
         completed_at = NOW(),
         last_accessed_at = NOW()`,
            [traineeId, simulationId, bestScore]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error("Simulation completion endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));
