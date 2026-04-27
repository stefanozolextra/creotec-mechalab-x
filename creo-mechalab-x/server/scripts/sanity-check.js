#!/usr/bin/env node

require("dotenv").config();
const { Pool } = require("pg");

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);

function normalizeSslOverride() {
    return String(process.env.DATABASE_SSL ?? "")
        .trim()
        .toLowerCase();
}

function shouldUseSsl(hostname) {
    const sslOverride = normalizeSslOverride();
    if (["true", "1", "yes", "on", "require"].includes(sslOverride)) return true;
    if (["false", "0", "no", "off", "disable"].includes(sslOverride)) return false;
    if (LOCAL_DATABASE_HOSTS.has(String(hostname || "").trim().toLowerCase())) return false;
    return process.env.NODE_ENV === "production";
}

function buildPoolConfig() {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (databaseUrl) {
        let databaseHost = "";
        try {
            databaseHost = new URL(databaseUrl).hostname;
        } catch {
            databaseHost = "";
        }

        return {
            connectionString: databaseUrl,
            ssl: shouldUseSsl(databaseHost) ? { rejectUnauthorized: false } : false,
        };
    }

    const config = {};
    if (process.env.PGHOST) config.host = process.env.PGHOST;
    if (process.env.PGPORT) {
        const parsedPort = Number(process.env.PGPORT);
        if (Number.isInteger(parsedPort) && parsedPort > 0) config.port = parsedPort;
    }
    if (process.env.PGDATABASE) config.database = process.env.PGDATABASE;
    if (process.env.PGUSER) config.user = process.env.PGUSER;
    if (process.env.PGPASSWORD) config.password = process.env.PGPASSWORD;
    config.ssl = shouldUseSsl(config.host) ? { rejectUnauthorized: false } : false;
    return config;
}

function printHeader(title) {
    console.log(`\n=== ${title} ===`);
}

function checkResult(name, passed, detail) {
    const mark = passed ? "PASS" : "FAIL";
    console.log(`[${mark}] ${name} - ${detail}`);
    return passed;
}

async function run() {
    const pool = new Pool(buildPoolConfig());
    const client = await pool.connect();

    let allPassed = true;

    try {
        await client.query("BEGIN");
        await client.query("SET TRANSACTION READ ONLY");

        const roleDistribution = await client.query(
            `SELECT role, COUNT(*)::INT AS count
             FROM accounts
             GROUP BY role
             ORDER BY role`
        );

        printHeader("Role Distribution");
        if (roleDistribution.rows.length === 0) {
            console.log("(no rows in accounts)");
        } else {
            for (const row of roleDistribution.rows) {
                console.log(`- ${row.role}: ${row.count}`);
            }
        }

        const accessModeDistribution = await client.query(
            `SELECT access_mode, COUNT(*)::INT AS count
             FROM accounts
             GROUP BY access_mode
             ORDER BY access_mode`
        );

        printHeader("Access Mode Distribution");
        if (accessModeDistribution.rows.length === 0) {
            console.log("(no rows in accounts)");
        } else {
            for (const row of accessModeDistribution.rows) {
                console.log(`- ${row.access_mode}: ${row.count}`);
            }
        }

        const adminProtectedRows = await client.query(
            `SELECT
               login_email,
               role,
               access_mode,
               is_system_protected,
               trainee_id,
               COALESCE(substring(password_hash FROM 1 FOR 4), '(null)') AS password_hash_prefix
             FROM accounts
             WHERE role = 'admin' OR is_system_protected = TRUE
             ORDER BY login_email`
        );

        printHeader("Admin/Protected Accounts");
        if (adminProtectedRows.rows.length === 0) {
            console.log("(none)");
        } else {
            for (const row of adminProtectedRows.rows) {
                console.log(
                    `- ${row.login_email} | role=${row.role} | access_mode=${row.access_mode} | protected=${row.is_system_protected} | trainee_id=${
                        row.trainee_id == null ? "null" : row.trainee_id
                    } | hash_prefix=${row.password_hash_prefix}`
                );
            }
        }

        const invalidLinkCountResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE (role = 'admin' AND trainee_id IS NOT NULL)
                OR (role = 'trainee' AND trainee_id IS NULL)`
        );
        const invalidLinkCount = Number(invalidLinkCountResult.rows[0]?.count) || 0;
        allPassed =
            checkResult(
                "No invalid role/trainee linkage rows",
                invalidLinkCount === 0,
                `${invalidLinkCount} invalid row(s)`
            ) && allPassed;

        const invalidAccessModeResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE access_mode IS NULL
                OR access_mode NOT IN ('standard', 'lesson_only')`
        );
        const invalidAccessModeCount = Number(invalidAccessModeResult.rows[0]?.count) || 0;
        allPassed =
            checkResult(
                "All accounts use a valid access mode",
                invalidAccessModeCount === 0,
                `${invalidAccessModeCount} invalid row(s)`
            ) && allPassed;

        const adminProtectedCountResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE role = 'admin' OR is_system_protected = TRUE`
        );
        const adminProtectedCount = Number(adminProtectedCountResult.rows[0]?.count) || 0;
        allPassed =
            checkResult(
                "At least one admin/protected account exists",
                adminProtectedCount > 0,
                `${adminProtectedCount} admin/protected row(s)`
            ) && allPassed;

        const adminWithTraineeLinkResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE (role = 'admin' OR is_system_protected = TRUE)
               AND trainee_id IS NOT NULL`
        );
        const adminWithTraineeLinkCount = Number(adminWithTraineeLinkResult.rows[0]?.count) || 0;
        allPassed =
            checkResult(
                "All admin/protected accounts are not linked to trainee_id",
                adminWithTraineeLinkCount === 0,
                `${adminWithTraineeLinkCount} invalid admin/protected linkage row(s)`
            ) && allPassed;

        const badHashPrefixResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE (role = 'admin' OR is_system_protected = TRUE)
               AND (password_hash IS NULL OR left(password_hash, 4) NOT IN ('$2a$', '$2b$', '$2y$'))`
        );
        const badHashPrefixCount = Number(badHashPrefixResult.rows[0]?.count) || 0;
        allPassed =
            checkResult(
                "All admin/protected accounts have bcrypt-like hash prefix",
                badHashPrefixCount === 0,
                `${badHashPrefixCount} row(s) with invalid prefix`
            ) && allPassed;

        if (allPassed) {
            console.log("\nOverall: PASS");
        } else {
            console.log("\nOverall: FAIL");
        }

        await client.query("COMMIT");
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // no-op
        }
        console.error("\nSanity check execution error:");
        console.error(error?.message || error);
        allPassed = false;
    } finally {
        client.release();
        await pool.end();
    }

    process.exit(allPassed ? 0 : 1);
}

run();
