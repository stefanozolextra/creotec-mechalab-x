// const { Pool } = require("pg");

// if (!process.env.DATABASE_URL) {
//     throw new Error("DATABASE_URL is missing. Put it in server/.env");
// }

// // Log sanitized connection (no password)
// try {
//     const u = new URL(process.env.DATABASE_URL);
//     console.log(`🗄️ DB -> ${u.username}@${u.hostname}:${u.port}${u.pathname}`);
// } catch {
//     console.log("🗄️ DB -> (could not parse DATABASE_URL)");
// }

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// pool.on("error", (err) => {
//     console.error("❌ PG pool error:", err.message);
// });

// module.exports = pool;

const { Pool } = require("pg");
require("dotenv").config();

// We check if the environment is production (like Railway) to enable SSL
const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // CRITICAL FIX: Supabase requires SSL connections from external servers
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

module.exports = pool;