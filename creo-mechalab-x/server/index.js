require("dotenv").config({ override: true });
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
    const r = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: r.rows[0].now });
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
        const traineeId = Number(req.params.traineeId);
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));