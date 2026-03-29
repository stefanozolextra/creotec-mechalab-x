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

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Put it in server/.env");
}

// Log sanitized connection (no password)
try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`🗄️ DB -> ${u.username}@${u.hostname}:${u.port}${u.pathname}`);
} catch {
    console.log("🗄️ DB -> (could not parse DATABASE_URL)");
}

// CRITICAL FIX: Add SSL for cloud database connections
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err) => {
    console.error("❌ PG pool error:", err.message);
});

module.exports = pool;