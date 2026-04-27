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

const databaseUrl = process.env.DATABASE_URL;
let parsedDatabaseUrl = null;

// Log sanitized connection (no password)
try {
    parsedDatabaseUrl = new URL(databaseUrl);
    console.log(`🗄️ DB -> ${parsedDatabaseUrl.username}@${parsedDatabaseUrl.hostname}:${parsedDatabaseUrl.port}${parsedDatabaseUrl.pathname}`);
} catch {
    console.log("🗄️ DB -> (could not parse DATABASE_URL)");
}

const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
const databaseHost = parsedDatabaseUrl?.hostname?.trim().toLowerCase() || "";
const databaseSslOverride = String(process.env.DATABASE_SSL ?? "").trim().toLowerCase();

function shouldUseDatabaseSsl() {
    if (["true", "1", "yes", "on", "require"].includes(databaseSslOverride)) return true;
    if (["false", "0", "no", "off", "disable"].includes(databaseSslOverride)) return false;
    if (localDatabaseHosts.has(databaseHost)) return false;
    return process.env.NODE_ENV === "production";
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseDatabaseSsl() ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
    console.error("❌ PG pool error:", err.message);
});

module.exports = pool;
