require("dotenv").config({ override: true });
const { Pool } = require("pg");

const pool = new Pool({
    host: "127.0.0.1",
    port: 5433,
    user: "creotec_user",
    password: "creotec_pass_ChangeMe",
    database: "mechalabx_db",
});

(async () => {
    try {
        const who = await pool.query("SELECT current_user, current_database(), inet_server_addr(), inet_client_addr();");
        console.log("✅ Connected:", who.rows[0]);

        const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM trainees) as trainees,
        (SELECT COUNT(*) FROM modules) as modules,
        (SELECT COUNT(*) FROM simulations) as simulations,
        (SELECT COUNT(*) FROM trainee_simulation_progress) as progress_rows
    `);
        console.log("✅ Counts:", counts.rows[0]);
    } catch (err) {
        console.error("❌ DB Error:", err.message);
    } finally {
        await pool.end();
    }
})();