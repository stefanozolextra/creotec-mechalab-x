require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { parse } = require("csv-parse/sync");
const pool = require("./db");
const { generateStrongPassword } = require("./utils/passwords");
const { sendTraineeCredentialsEmail } = require("./utils/mailer");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Put it in server/.env");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN?.trim() || "8h";
const DEFAULT_TRAINEE_PASSWORD = process.env.DEFAULT_TRAINEE_PASSWORD?.trim() || "";
const SHOULD_RETURN_GENERATED_PASSWORD =
    process.env.RETURN_GENERATED_PASSWORD?.trim().toLowerCase() === "true" && process.env.NODE_ENV !== "production";
const BATCH_CODE_REGEX = /^\d{4}-(CTT|IMM)\d{2}$/;
const RESEND_CREDENTIALS_COOLDOWN_MS = 5 * 60 * 1000;
let hasLoggedMissingSmtpConfig = false;

function parsePositiveIntEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || String(raw).trim() === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return parsed;
}

const DASHBOARD_CACHE_TTL_MS = parsePositiveIntEnv("DASHBOARD_CACHE_TTL_MS", 10_000);
const ACTIVITYLOGS_CACHE_TTL_MS = parsePositiveIntEnv("ACTIVITYLOGS_CACHE_TTL_MS", 10_000);
const MAX_CACHE_ENTRIES = parsePositiveIntEnv("MAX_CACHE_ENTRIES", 100);
const MODULE_TITLE_MAX_LENGTH = 150;
const LESSON_TITLE_MAX_LENGTH = 150;
const LESSON_PDF_MAX_FILE_SIZE_BYTES = parsePositiveIntEnv("LESSON_PDF_MAX_FILE_SIZE_BYTES", 10 * 1024 * 1024);
const LESSON_UPLOADS_DIR = path.resolve(
    __dirname,
    process.env.LESSON_UPLOADS_DIR?.trim() || path.join("uploads", "module-pdfs")
);
const LESSON_RESOURCE_TYPE_PDF = "PDF";
const LESSON_RESOURCE_TYPE_VIDEO = "VIDEO";
const DIRECT_VIDEO_ALLOWED_EXTENSIONS = new Set([".mp4", ".webm"]);
const PDF_ALLOWED_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);

const adminDashboardCache = new Map();
const adminActivityLogsCache = new Map();
const adminDashboardInflight = new Map();
const adminActivityLogsInflight = new Map();

function cacheGet(map, key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        map.delete(key);
        return null;
    }
    return entry.value;
}

function cachePrune(map, maxEntries) {
    const now = Date.now();
    for (const [key, entry] of map.entries()) {
        if (!entry || entry.expiresAt <= now) {
            map.delete(key);
        }
    }

    while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === undefined) break;
        map.delete(oldestKey);
    }
}

function cacheSet(map, key, value, ttlMs) {
    const safeTtl = Number.isFinite(Number(ttlMs)) && Number(ttlMs) > 0 ? Number(ttlMs) : 1;
    const expiresAt = Date.now() + safeTtl;
    if (map.has(key)) {
        map.delete(key);
    }
    map.set(key, { expiresAt, value });
    cachePrune(map, MAX_CACHE_ENTRIES);
}

function setCacheHeaders(res, status, key) {
    res.setHeader("X-Cache", status);
    if (process.env.NODE_ENV !== "production") {
        res.setHeader("X-Cache-Key", key);
    }
}

function getOrCreateInflight(inflightMap, key, createPromise) {
    const existing = inflightMap.get(key);
    if (existing) return existing;

    let promise;
    promise = (async () => {
        try {
            return await createPromise();
        } finally {
            if (inflightMap.get(key) === promise) {
                inflightMap.delete(key);
            }
        }
    })();

    inflightMap.set(key, promise);
    return promise;
}

function invalidateAdminCaches() {
    adminDashboardCache.clear();
    adminActivityLogsCache.clear();
    adminDashboardInflight.clear();
    adminActivityLogsInflight.clear();
}

function normalizeEmail(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
);

function isBootstrapAdminEmail(email) {
    return ADMIN_EMAILS.has(normalizeEmail(email));
}

function logAdminCreateCredentialEmailFailure(errorMessage) {
    if (errorMessage === "SMTP is not configured.") {
        if (hasLoggedMissingSmtpConfig) return;
        hasLoggedMissingSmtpConfig = true;
    }

    console.error("Admin create trainee credential email failed:", errorMessage);
}

function roleFromAccountRow(account) {
    if (account?.role === "admin" || account?.is_system_protected === true) {
        return "admin";
    }
    return "trainee";
}

async function resolveLoginAccountRole(client, accountId) {
    await client.query("BEGIN");
    try {
        // Serialize bootstrap-admin promotion so only one first admin can be promoted deterministically.
        await client.query("SELECT pg_advisory_xact_lock(hashtext('accounts_admin_bootstrap'))");

        const accountResult = await client.query(
            `SELECT account_id, trainee_id, login_email, is_active, role, is_system_protected
             FROM accounts
             WHERE account_id = $1
             FOR UPDATE`,
            [accountId]
        );

        if (accountResult.rowCount === 0) {
            throw new Error("Account not found during role resolution");
        }

        let account = accountResult.rows[0];
        const adminExistsResult = await client.query(
            `SELECT EXISTS(
               SELECT 1
               FROM accounts
               WHERE role = 'admin' OR is_system_protected = TRUE
             ) AS has_admin`
        );
        const hasAdmin = adminExistsResult.rows[0]?.has_admin === true;

        // Bootstrap-only behavior:
        // promote an allowlisted account only when zero admins exist in DB.
        if (!hasAdmin && isBootstrapAdminEmail(account.login_email)) {
            const promotedResult = await client.query(
                `UPDATE accounts
                 SET role = 'admin',
                     is_system_protected = TRUE,
                     trainee_id = NULL
                 WHERE account_id = $1
                 RETURNING account_id, trainee_id, login_email, is_active, role, is_system_protected`,
                [accountId]
            );
            account = promotedResult.rows[0];
        }

        await client.query("COMMIT");
        return account;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed while resolving login role:", rollbackError);
        }
        throw error;
    }
}

function requireAuth(req, res, next) {
    const authorization = req.headers.authorization || "";
    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || typeof decoded !== "object") {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const roleValue = decoded.role === "student" ? "trainee" : decoded.role;
        const accountId = Number(decoded.account_id);
        if (!Number.isInteger(accountId) || accountId < 1 || (roleValue !== "admin" && roleValue !== "trainee")) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const subject = typeof decoded.sub === "string" && decoded.sub.trim() ? decoded.sub : String(accountId);
        const traineeIdRaw = decoded.trainee_id;
        let traineeId = null;
        if (traineeIdRaw !== undefined && traineeIdRaw !== null) {
            const parsedTraineeId = Number(traineeIdRaw);
            if (!Number.isInteger(parsedTraineeId) || parsedTraineeId < 1) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            traineeId = parsedTraineeId;
        }

        req.auth = { sub: subject, role: roleValue, account_id: accountId, trainee_id: traineeId };
        next();
    } catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

async function requireAdmin(req, res, next) {
    const accountId = Number(req.auth?.account_id);
    if (!Number.isInteger(accountId) || accountId < 1) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const result = await pool.query(
            `SELECT account_id, trainee_id, role, is_active, is_system_protected
             FROM accounts
             WHERE account_id = $1
             LIMIT 1`,
            [accountId]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const account = result.rows[0];
        if (!account.is_active) {
            return res.status(403).json({ error: "Account is inactive" });
        }

        if (account.role !== "admin" && account.is_system_protected !== true) {
            return res.status(403).json({ error: "Forbidden" });
        }

        req.auth = {
            ...req.auth,
            role: roleFromAccountRow(account),
            trainee_id: account.trainee_id == null ? null : Number(account.trainee_id),
        };
        next();
    } catch (error) {
        console.error("Admin authorization failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

function parsePositiveIntParam(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function parseNonNegativeInt(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
}

function formatModuleCodeFromNumber(value) {
    const parsed = Number(value);
    const safeNumber = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    return `M${String(safeNumber).padStart(2, "0")}`;
}

function extractModuleCodeNumber(value) {
    const match = /^M(\d+)$/i.exec(String(value || "").trim());
    if (!match) return null;
    const parsed = Number(match[1]);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function sanitizeOptionalString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildTraineeFullName(value) {
    const firstName = sanitizeOptionalString(value?.first_name) || "";
    const middleName = sanitizeOptionalString(value?.middle_name) || "";
    const lastName = sanitizeOptionalString(value?.last_name) || "";

    return [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || "Trainee";
}

function validateEmailFormat(value) {
    return typeof value === "string" && value.includes("@") && value.includes(".");
}

function validateBatchCodeFormat(value) {
    return typeof value === "string" && BATCH_CODE_REGEX.test(value.trim());
}

function validateDateYYYYMMDD(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeAdminActivityLogsLimit(limitInput, defaultLimit = 50) {
    let limit = defaultLimit;
    if (limitInput !== undefined && limitInput !== null) {
        const parsed = Number(limitInput);
        if (Number.isFinite(parsed)) {
            limit = Math.trunc(parsed);
        }
    }
    return Math.max(1, Math.min(limit, 200));
}

function normalizeAdminActivityLogsMode(modeInput) {
    const normalized = typeof modeInput === "string" ? modeInput.trim().toLowerCase() : "";
    if (!normalized || normalized === "system") return "system";
    if (normalized === "trainee_progress") return "trainee_progress";

    const error = new Error("Invalid mode");
    error.statusCode = 400;
    throw error;
}

function normalizeAdminActivityLogsSearch(searchInput) {
    if (typeof searchInput !== "string") return "";
    return searchInput.trim().slice(0, 120);
}

function normalizeAdminActivityLogCursorDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        const error = new Error("Invalid before cursor");
        error.statusCode = 400;
        throw error;
    }
    return parsed.toISOString();
}

function encodeAdminActivityLogsCursor(occurredAt, eventId) {
    return Buffer.from(
        JSON.stringify({
            occurred_at: occurredAt,
            event_id: eventId,
        }),
        "utf8"
    ).toString("base64url");
}

function normalizeAdminActivityLogsBeforeCursor(beforeInput) {
    if (typeof beforeInput !== "string" || beforeInput.trim() === "") return null;

    const rawCursor = beforeInput.trim();

    try {
        const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === "object" && typeof parsed.occurred_at === "string") {
            return {
                occurredAt: normalizeAdminActivityLogCursorDate(parsed.occurred_at),
                eventId: typeof parsed.event_id === "string" && parsed.event_id.trim() ? parsed.event_id.trim() : null,
            };
        }
    } catch {}

    return {
        occurredAt: normalizeAdminActivityLogCursorDate(rawCursor),
        eventId: null,
    };
}

function mapAdminActivityLogRow(row) {
    const occurredAt = row.occurred_at ? new Date(row.occurred_at).toISOString() : new Date().toISOString();
    const normalizedType =
        row.type === "system_reset"
            ? "system_reset"
            : row.type === "trainee_created"
              ? "trainee_created"
              : row.type === "simulation_completed"
                ? "simulation_completed"
                : "batch_export";
    const meta = row.meta && typeof row.meta === "object" ? row.meta : undefined;
    const item = {
        event_id:
            typeof row.event_id === "string" && row.event_id.trim()
                ? row.event_id
                : `${normalizedType}:${occurredAt}`,
        type: normalizedType,
        occurred_at: occurredAt,
        batch_code: row.batch_code || null,
        actor: row.actor || null,
        message: row.message || "",
        ...(meta ? { meta } : {}),
    };

    if (row.trainee_id !== undefined && row.trainee_id !== null) {
        item.trainee_id = row.trainee_id;
    }
    if (row.trainee_name !== undefined && row.trainee_name !== null) {
        item.trainee_name = row.trainee_name;
    }
    if (row.trainee_code !== undefined && row.trainee_code !== null) {
        item.trainee_code = row.trainee_code;
    }
    if (row.trainee_email !== undefined && row.trainee_email !== null) {
        item.trainee_email = row.trainee_email;
    }
    if (row.module_id !== undefined && row.module_id !== null) {
        item.module_id = row.module_id;
    }
    if (row.module_title !== undefined && row.module_title !== null) {
        item.module_title = row.module_title;
    }
    if (row.simulation_id !== undefined && row.simulation_id !== null) {
        item.simulation_id = row.simulation_id;
    }
    if (row.simulation_title !== undefined && row.simulation_title !== null) {
        item.simulation_title = row.simulation_title;
    }
    if (row.status !== undefined && row.status !== null) {
        item.status = row.status;
    }
    if (row.best_score !== undefined) {
        item.score = row.best_score === null ? null : Number(row.best_score);
    }
    if (row.attempt_count !== undefined) {
        item.attempt_count = row.attempt_count === null ? null : Number(row.attempt_count);
    }

    return item;
}

async function fetchSystemAdminActivityLogs({ batchCode = null, limit, before } = {}) {
    const normalizedLimit = normalizeAdminActivityLogsLimit(limit);
    const beforeCursor = normalizeAdminActivityLogsBeforeCursor(before);

    const result = await pool.query(
        `SELECT event_id, type, occurred_at, batch_code, actor, message, meta
         FROM (
           -- Mapping from audit schema:
           -- batch_exports.exported_at and system_resets.reset_at -> occurred_at,
           -- exported_by_account_id/reset_by_account_id -> actor via accounts.login_email,
           -- batch_code is already stored directly in both audit tables.
           SELECT
             CONCAT('batch_export:', be.batch_export_id)::TEXT AS event_id,
             'batch_export'::TEXT AS type,
             be.exported_at AS occurred_at,
             COALESCE(b.batch_code, be.batch_code) AS batch_code,
             actor.login_email AS actor,
             CONCAT(
               'Exported ',
               be.rows_exported,
               ' trainee record',
               CASE WHEN be.rows_exported = 1 THEN '' ELSE 's' END,
               ' (',
               be.file_name,
               ').'
             ) AS message,
             jsonb_build_object(
               'rows_exported', be.rows_exported,
               'file_name', be.file_name
             ) AS meta
           FROM batch_exports be
           LEFT JOIN accounts actor ON actor.account_id = be.exported_by_account_id
           LEFT JOIN batches b ON b.batch_code = be.batch_code

           UNION ALL

           SELECT
             CONCAT('system_reset:', sr.reset_id)::TEXT AS event_id,
             'system_reset'::TEXT AS type,
             sr.reset_at AS occurred_at,
             COALESCE(b.batch_code, sr.batch_code) AS batch_code,
             actor.login_email AS actor,
             CONCAT(
               'System reset removed ',
               sr.deleted_trainees,
               ' trainee',
               CASE WHEN sr.deleted_trainees = 1 THEN '' ELSE 's' END,
               ', ',
               sr.deleted_trainee_accounts,
               ' account',
               CASE WHEN sr.deleted_trainee_accounts = 1 THEN '' ELSE 's' END,
               ', ',
               sr.deleted_progress_rows,
               ' progress row',
               CASE WHEN sr.deleted_progress_rows = 1 THEN '' ELSE 's' END,
               ', and ',
               sr.deleted_batches,
               ' batch',
               CASE WHEN sr.deleted_batches = 1 THEN '' ELSE 'es' END,
               CASE WHEN sr.forced THEN ' (forced).' ELSE '.' END
             ) AS message,
             jsonb_build_object(
               'deleted_progress_rows', sr.deleted_progress_rows,
               'deleted_trainee_accounts', sr.deleted_trainee_accounts,
               'deleted_trainees', sr.deleted_trainees,
               'deleted_batches', sr.deleted_batches,
               'forced', sr.forced
             ) AS meta
           FROM system_resets sr
           LEFT JOIN accounts actor ON actor.account_id = sr.reset_by_account_id
           LEFT JOIN batches b ON b.batch_code = sr.batch_code
         ) events
         WHERE ($1::TEXT IS NULL OR events.batch_code = $1)
           AND (
             $2::TIMESTAMPTZ IS NULL
             OR events.occurred_at < $2
             OR ($3::TEXT IS NOT NULL AND events.occurred_at = $2 AND events.event_id < $3)
           )
         ORDER BY events.occurred_at DESC, events.event_id DESC
         LIMIT $4`,
        [batchCode, beforeCursor?.occurredAt || null, beforeCursor?.eventId || null, normalizedLimit]
    );

    const items = result.rows.map(mapAdminActivityLogRow);
    const lastItem = items.length > 0 ? items[items.length - 1] : null;

    return {
        items,
        limit: normalizedLimit,
        next_before:
            items.length < normalizedLimit || !lastItem
                ? null
                : encodeAdminActivityLogsCursor(lastItem.occurred_at, lastItem.event_id),
    };
}

async function fetchTraineeProgressAdminActivityLogs({ batchCode = null, limit, before, search = "" } = {}) {
    const normalizedLimit = normalizeAdminActivityLogsLimit(limit);
    const beforeCursor = normalizeAdminActivityLogsBeforeCursor(before);
    const normalizedSearch = normalizeAdminActivityLogsSearch(search);
    const searchPattern = normalizedSearch ? `%${normalizedSearch}%` : null;
    const numericSearchId =
        /^\d+$/.test(normalizedSearch) && Number.isSafeInteger(Number(normalizedSearch)) ? Number(normalizedSearch) : null;

    const result = await pool.query(
        `SELECT
           events.event_id,
           events.type,
           events.occurred_at,
           events.batch_code,
           events.actor,
           events.message,
           events.meta,
           events.trainee_id,
           events.trainee_name,
           events.trainee_code,
           events.trainee_email,
           events.module_id,
           events.module_title,
           events.simulation_id,
           events.simulation_title,
           events.status,
           events.best_score,
           events.attempt_count
         FROM (
           SELECT
             CONCAT('simulation_completed:', tsp.trainee_id, ':', tsp.simulation_id)::TEXT AS event_id,
             'simulation_completed'::TEXT AS type,
             tsp.completed_at AS occurred_at,
             b.batch_code,
             COALESCE(
               NULLIF(BTRIM(CONCAT_WS(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name)), ''),
               NULLIF(t.trainee_code, ''),
               NULLIF(COALESCE(a.login_email, t.email), ''),
               CONCAT('Trainee #', t.trainee_id::TEXT)
             ) AS actor,
             CONCAT(
               COALESCE(
                 NULLIF(BTRIM(CONCAT_WS(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name)), ''),
                 NULLIF(t.trainee_code, ''),
                 NULLIF(COALESCE(a.login_email, t.email), ''),
                 CONCAT('Trainee #', t.trainee_id::TEXT)
               ),
               ' completed ',
               COALESCE(NULLIF(s.title, ''), CONCAT('Simulation ', s.simulation_code)),
               CASE
                 WHEN NULLIF(m.title, '') IS NULL THEN '.'
                 ELSE CONCAT(' in ', m.title, '.')
               END
             ) AS message,
             jsonb_build_object(
               'status', tsp.status,
               'score', tsp.best_score,
               'attempt_count', tsp.attempts_count,
               'trainee_code', t.trainee_code,
               'trainee_email', COALESCE(a.login_email, t.email),
               'module_title', m.title,
               'simulation_title', s.title
             ) AS meta,
             tsp.trainee_id,
             COALESCE(
               NULLIF(BTRIM(CONCAT_WS(' ', t.first_name, NULLIF(t.middle_name, ''), t.last_name)), ''),
               NULLIF(t.trainee_code, ''),
               NULLIF(COALESCE(a.login_email, t.email), ''),
               CONCAT('Trainee #', t.trainee_id::TEXT)
             ) AS trainee_name,
             t.trainee_code,
             COALESCE(a.login_email, t.email) AS trainee_email,
             m.module_id,
             m.title AS module_title,
             s.simulation_id,
             s.title AS simulation_title,
             tsp.status,
             tsp.best_score,
             tsp.attempts_count AS attempt_count
           FROM trainee_simulation_progress tsp
           JOIN trainees t ON t.trainee_id = tsp.trainee_id
           JOIN batches b ON b.batch_id = t.batch_id
           JOIN simulations s ON s.simulation_id = tsp.simulation_id
           LEFT JOIN modules m ON m.module_id = s.module_id
           LEFT JOIN accounts a ON a.trainee_id = t.trainee_id
           WHERE tsp.status = 'COMPLETED'
             AND tsp.completed_at IS NOT NULL
             AND ($1::TEXT IS NULL OR b.batch_code = $1)
             AND (
               $2::TEXT IS NULL
               OR t.trainee_code ILIKE $2
               OR t.email ILIKE $2
               OR COALESCE(a.login_email, '') ILIKE $2
               OR t.first_name ILIKE $2
               OR COALESCE(t.middle_name, '') ILIKE $2
               OR t.last_name ILIKE $2
               OR CONCAT_WS(' ', t.first_name, t.middle_name, t.last_name) ILIKE $2
               OR ($3::BIGINT IS NOT NULL AND t.trainee_id = $3)
             )
         ) events
         WHERE (
             $4::TIMESTAMPTZ IS NULL
             OR events.occurred_at < $4
             OR ($5::TEXT IS NOT NULL AND events.occurred_at = $4 AND events.event_id < $5)
         )
         ORDER BY events.occurred_at DESC, events.event_id DESC
         LIMIT $6`,
        [
            batchCode,
            searchPattern,
            numericSearchId,
            beforeCursor?.occurredAt || null,
            beforeCursor?.eventId || null,
            normalizedLimit,
        ]
    );

    const items = result.rows.map(mapAdminActivityLogRow);
    const lastItem = items.length > 0 ? items[items.length - 1] : null;

    return {
        items,
        limit: normalizedLimit,
        next_before:
            items.length < normalizedLimit || !lastItem
                ? null
                : encodeAdminActivityLogsCursor(lastItem.occurred_at, lastItem.event_id),
    };
}

async function fetchAdminActivityLogs({ mode = "system", batchCode = null, limit, before, search = "" } = {}) {
    if (mode === "trainee_progress") {
        return fetchTraineeProgressAdminActivityLogs({
            batchCode,
            limit,
            before,
            search,
        });
    }

    return fetchSystemAdminActivityLogs({
        batchCode,
        limit,
        before,
    });
}

function mapAdminTraineeRowToItem(row) {
    const totalModules = Number(row.total_modules) || 0;
    const completedModules = Number(row.completed_modules) || 0;
    const percent = totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100);
    const label =
        totalModules === 0 ? "0/0 Modules" : percent === 100 ? "Done" : `${completedModules}/${totalModules} Modules`;

    return {
        trainee_id: row.trainee_id,
        trainee_code: row.trainee_code,
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        email: row.email,
        contact_number: row.contact_number,
        batch: {
            batch_id: row.batch_id,
            batch_code: row.batch_code,
        },
        status: row.is_active ? "active" : "inactive",
        progress: {
            completed_modules: completedModules,
            total_modules: totalModules,
            percent,
            label,
        },
    };
}

function escapeCsvValue(value) {
    const asString = value == null ? "" : String(value);
    if (/[",\n\r]/.test(asString)) {
        return `"${asString.replace(/"/g, '""')}"`;
    }
    return asString;
}

function buildCsvRow(values) {
    return values.map((value) => escapeCsvValue(value)).join(",");
}

async function fetchAdminTraineeById(clientOrPool, traineeId) {
    const result = await clientOrPool.query(
        `SELECT
           t.trainee_id,
           t.trainee_code,
           t.first_name,
           t.middle_name,
           t.last_name,
           t.email,
           t.contact_number,
           b.batch_id,
           b.batch_code,
           a.is_active,
           COALESCE(progress.completed_modules, 0)::INT AS completed_modules,
           COALESCE(progress.total_modules, 0)::INT AS total_modules
         FROM trainees t
         JOIN accounts a ON a.trainee_id = t.trainee_id
         JOIN batches b ON b.batch_id = t.batch_id
         LEFT JOIN (
           SELECT
             trainee_id,
             COUNT(*)::INT AS total_modules,
             COUNT(*) FILTER (WHERE module_status = 'COMPLETED')::INT AS completed_modules
           FROM v_trainee_module_status
           GROUP BY trainee_id
         ) progress ON progress.trainee_id = t.trainee_id
         WHERE t.trainee_id = $1
         LIMIT 1`,
        [traineeId]
    );

    if (result.rowCount === 0) return null;
    return mapAdminTraineeRowToItem(result.rows[0]);
}

function getConflictErrorMessage(error) {
    const constraint = String(error?.constraint || "").toLowerCase();
    if (constraint.includes("login_email") || constraint.includes("email")) {
        return "Email already exists";
    }
    if (constraint.includes("trainee_code")) {
        return "Trainee code already exists";
    }

    const details = `${error?.detail || ""} ${error?.message || ""}`.toLowerCase();

    if (details.includes("login_email") || details.includes("email")) {
        return "Email already exists";
    }
    if (details.includes("trainee_code")) {
        return "Trainee code already exists";
    }
    return "Conflict";
}

function parseAdminTraineePayload(body) {
    if (!body || typeof body !== "object") {
        return { error: "Invalid request body" };
    }

    if (!isNonEmptyString(body.first_name)) return { error: "first_name is required" };
    if (!isNonEmptyString(body.last_name)) return { error: "last_name is required" };
    if (!isNonEmptyString(body.email)) return { error: "email is required" };

    const email = normalizeEmail(body.email);
    if (!validateEmailFormat(email)) return { error: "Invalid email format" };

    const batchCode = sanitizeOptionalString(body.batch_code);
    const batchId = parsePositiveIntParam(body.batch_id);
    if (!batchCode && !batchId) return { error: "batch_code or batch_id is required" };

    const birthDateValue = sanitizeOptionalString(body.birth_date);
    if (birthDateValue && !validateDateYYYYMMDD(birthDateValue)) {
        return { error: "Invalid birth_date format" };
    }

    return {
        value: {
            first_name: body.first_name.trim(),
            middle_name: sanitizeOptionalString(body.middle_name),
            last_name: body.last_name.trim(),
            email,
            contact_number: sanitizeOptionalString(body.contact_number),
            address: sanitizeOptionalString(body.address),
            birth_date: birthDateValue,
            batch_code: batchCode,
            batch_id: batchId,
        },
    };
}

async function resolveBatchForTraineePayload(client, payload) {
    if (payload.batch_code) {
        const byCode = await client.query(
            `SELECT batch_id, batch_code
             FROM batches
             WHERE batch_code = $1
             LIMIT 1`,
            [payload.batch_code]
        );
        if (byCode.rowCount > 0) return byCode.rows[0];
        return null;
    }

    if (payload.batch_id) {
        const byId = await client.query(
            `SELECT batch_id, batch_code
             FROM batches
             WHERE batch_id = $1
             LIMIT 1`,
            [payload.batch_id]
        );
        if (byId.rowCount > 0) return byId.rows[0];
    }

    return null;
}

async function emailExistsForCreateTrainee(client, email) {
    const result = await client.query(
        `SELECT 1
         FROM accounts
         WHERE lower(login_email) = $1
         UNION ALL
         SELECT 1
         FROM trainees
         WHERE lower(email) = $1
         LIMIT 1`,
        [email]
    );
    return result.rowCount > 0;
}

// Example accepted CSV header row: First Name,Middle Name,Last Name,Student Email,Contact Number
const CSV_FIRST_NAME_HEADERS = new Set(["first name", "firstname"]);
const CSV_LAST_NAME_HEADERS = new Set(["last name", "lastname"]);
const CSV_EMAIL_HEADERS = new Set(["email", "student email"]);
const CSV_MIDDLE_NAME_HEADERS = new Set(["middle name", "middlename"]);
const CSV_CONTACT_NUMBER_HEADERS = new Set(["contact number", "contactno"]);

function normalizeCsvHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[_-]/g, " ");
}

function parseCsvRecordsFromBuffer(buffer) {
    const csvText = buffer.toString("utf8");
    const requiredHeaders = {
        first_name: false,
        last_name: false,
        email: false,
    };

    const records = parse(csvText, {
        bom: true,
        columns: (headerRow) =>
            headerRow.map((header) => {
                const normalizedHeader = normalizeCsvHeader(header);
                if (CSV_FIRST_NAME_HEADERS.has(normalizedHeader)) {
                    requiredHeaders.first_name = true;
                    return "first_name";
                }
                if (CSV_LAST_NAME_HEADERS.has(normalizedHeader)) {
                    requiredHeaders.last_name = true;
                    return "last_name";
                }
                if (CSV_EMAIL_HEADERS.has(normalizedHeader)) {
                    requiredHeaders.email = true;
                    return "email";
                }
                if (CSV_MIDDLE_NAME_HEADERS.has(normalizedHeader)) return "middle_name";
                if (CSV_CONTACT_NUMBER_HEADERS.has(normalizedHeader)) return "contact_number";
                return null;
            }),
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
    });

    if (!requiredHeaders.first_name || !requiredHeaders.last_name || !requiredHeaders.email) {
        return { error: "CSV headers must include first_name, last_name, and email" };
    }

    const rows = [];

    for (let index = 0; index < records.length; index += 1) {
        const record = records[index] || {};
        const first_name = sanitizeOptionalString(record.first_name);
        const middle_name = sanitizeOptionalString(record.middle_name);
        const last_name = sanitizeOptionalString(record.last_name);
        const email = sanitizeOptionalString(record.email);
        const contact_number = sanitizeOptionalString(record.contact_number);

        if (!first_name && !middle_name && !last_name && !email && !contact_number) continue;

        rows.push({
            row: index + 2,
            first_name,
            middle_name,
            last_name,
            email: email ? normalizeEmail(email) : null,
            contact_number,
        });
    }

    return { rows };
}

async function ensureBatchByCode(client, batchCode) {
    const existing = await client.query(
        `SELECT batch_id, batch_code
         FROM batches
         WHERE batch_code = $1`,
        [batchCode]
    );
    if (existing.rowCount > 0) return existing.rows[0];

    try {
        const created = await client.query(
            `INSERT INTO batches (batch_code, description, start_date, end_date)
             VALUES ($1, NULL, NOW()::date, NULL)
             RETURNING batch_id, batch_code`,
            [batchCode]
        );
        return created.rows[0];
    } catch (error) {
        if (error?.code === "23505") {
            const retry = await client.query(
                `SELECT batch_id, batch_code
                 FROM batches
                 WHERE batch_code = $1`,
                [batchCode]
            );
            if (retry.rowCount > 0) return retry.rows[0];
        }
        throw error;
    }
}

async function lockBatchAndGetNextSequence(client, batchCode) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [batchCode]);

    const seqResult = await client.query(
        `SELECT COALESCE(MAX((substring(trainee_code FROM '([0-9]+)$'))::INT), 0) AS max_suffix
         FROM trainees
         WHERE trainee_code LIKE $1`,
        [`${batchCode}-%`]
    );

    return (Number(seqResult.rows[0]?.max_suffix) || 0) + 1;
}

async function createTraineeAndAccount(client, payload) {
    const traineeInsert = await client.query(
        `INSERT INTO trainees
          (batch_id, trainee_code, first_name, middle_name, last_name, email, contact_number, address, birth_date)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING trainee_id`,
        [
            payload.batch_id,
            payload.trainee_code,
            payload.first_name,
            payload.middle_name,
            payload.last_name,
            payload.email,
            payload.contact_number,
            payload.address ?? null,
            payload.birth_date ?? null,
        ]
    );

    await client.query(
        `INSERT INTO accounts
          (trainee_id, login_email, password_hash, is_active, role, is_system_protected)
         VALUES
          ($1, $2, $3, TRUE, 'trainee', FALSE)`,
        [traineeInsert.rows[0].trainee_id, payload.email, payload.password_hash]
    );

    return traineeInsert.rows[0].trainee_id;
}

async function findTraineeByEmail(client, email) {
    const result = await client.query(
        `SELECT
           t.trainee_id,
           t.batch_id,
           b.batch_code
         FROM trainees t
         JOIN batches b ON b.batch_id = t.batch_id
         LEFT JOIN accounts a ON a.trainee_id = t.trainee_id
         WHERE lower(t.email) = $1 OR lower(COALESCE(a.login_email, '')) = $1
         ORDER BY t.trainee_id
         LIMIT 1`,
        [email]
    );

    return result.rows[0] || null;
}

async function getBlockingTraineeDeleteReferences(client) {
    const fkRows = await client.query(
        `SELECT
           ns.nspname AS schema_name,
           rel.relname AS table_name,
           con.conname AS constraint_name,
           con.confdeltype AS on_delete_type
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace ns ON ns.oid = rel.relnamespace
         WHERE con.contype = 'f'
           AND con.confrelid = 'trainees'::regclass
           AND ns.nspname NOT IN ('pg_catalog', 'information_schema')`
    );

    return fkRows.rows.filter((row) => row.on_delete_type !== "c");
}

async function deleteTraineesWithSafety(client, whereSql, values) {
    const blockingRefs = await getBlockingTraineeDeleteReferences(client);
    if (blockingRefs.length > 0) {
        const tables = blockingRefs.map((row) => `${row.schema_name}.${row.table_name}`).join(", ");
        return { error: `Cannot purge trainees due to dependent tables without cascade: ${tables}` };
    }

    const countResult = await client.query(`SELECT COUNT(*)::INT AS count FROM trainees ${whereSql}`, values);
    const count = Number(countResult.rows[0]?.count) || 0;
    if (count > 0) {
        await client.query(`DELETE FROM trainees ${whereSql}`, values);
    }

    return { deleted: count };
}

function getAuthTraineeId(req) {
    const traineeId = Number(req.auth?.trainee_id);
    if (!Number.isInteger(traineeId) || traineeId < 1) return null;
    return traineeId;
}

function ensureTraineeOwnership(req, res, requestedTraineeId = null) {
    if (req.auth?.role !== "trainee") {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    const authTraineeId = getAuthTraineeId(req);
    if (!authTraineeId) {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    if (requestedTraineeId !== null && requestedTraineeId !== authTraineeId) {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    return authTraineeId;
}

function formatTimestampForFileName(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    const seconds = String(value.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function formatTimestampForMinuteFileName(value = new Date()) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}-${hours}${minutes}`;
}

function toSafeFileToken(value) {
    return String(value || "")
        .trim()
        .replace(/[^A-Za-z0-9-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function buildModuleResourcePdfViewPath(resourceId) {
    return `/api/resources/${resourceId}/pdf`;
}

function sanitizePdfOriginalFilename(value, fallback = "module.pdf") {
    const candidate = path.basename(String(value || "").trim()) || fallback;
    const withoutControlChars = candidate.replace(/[\u0000-\u001f\u007f]/g, "");
    const sanitized = withoutControlChars
        .replace(/[^A-Za-z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!sanitized) return fallback;
    return path.extname(sanitized).toLowerCase() === ".pdf" ? sanitized : `${sanitized}.pdf`;
}

function isPdfExtensionFileName(value) {
    return path.extname(String(value || "").trim()).toLowerCase() === ".pdf";
}

function isAllowedPdfMimeType(value) {
    const mimeType = String(value || "")
        .trim()
        .toLowerCase();
    return PDF_ALLOWED_MIME_TYPES.has(mimeType);
}

function hasPdfMagicBytes(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function createLessonPdfStorageKey(moduleId) {
    const timestamp = formatTimestampForFileName();
    const randomToken = crypto.randomBytes(12).toString("hex");
    return `module_${moduleId}_${timestamp}_${randomToken}.pdf`;
}

function resolveLessonPdfStoragePath(storageKey) {
    const normalizedKey = String(storageKey || "").trim();
    if (!/^[A-Za-z0-9._-]+$/.test(normalizedKey)) {
        throw new Error("Invalid storage key");
    }

    const resolved = path.resolve(LESSON_UPLOADS_DIR, normalizedKey);
    const safePrefix = LESSON_UPLOADS_DIR.endsWith(path.sep) ? LESSON_UPLOADS_DIR : `${LESSON_UPLOADS_DIR}${path.sep}`;
    if (resolved !== LESSON_UPLOADS_DIR && !resolved.startsWith(safePrefix)) {
        throw new Error("Invalid storage path");
    }
    return resolved;
}

async function ensureLessonUploadsDirectory() {
    await fsPromises.mkdir(LESSON_UPLOADS_DIR, { recursive: true });
}

async function removeStoredLessonPdf(storageKey) {
    try {
        const filePath = resolveLessonPdfStoragePath(storageKey);
        await fsPromises.unlink(filePath);
    } catch (error) {
        if (error?.code === "ENOENT") return;
        console.error("Failed to remove stored lesson PDF:", error);
    }
}

function extractFileNameFromUrl(urlValue) {
    if (!urlValue) return null;
    try {
        const parsed = new URL(String(urlValue), "http://local.invalid");
        const baseName = path.basename(parsed.pathname || "");
        if (!baseName) return null;
        return sanitizePdfOriginalFilename(baseName);
    } catch {
        return null;
    }
}

function getModuleResourcesWithFilesSql() {
    return `SELECT
              mr.resource_id::INT AS resource_id,
              mr.module_id::INT AS module_id,
              mr.type,
              mr.title,
              COALESCE(
                CASE WHEN mrf.file_id IS NOT NULL THEN '/api/resources/' || mr.resource_id::TEXT || '/pdf' END,
                mr.url
              ) AS url,
              mr.order_no::INT AS order_no,
              mrf.file_id::INT AS file_id,
              mrf.original_filename,
              mrf.mime_type,
              mrf.file_size,
              (mrf.file_id IS NOT NULL) AS has_uploaded_file,
              CASE
                WHEN mrf.file_id IS NOT NULL THEN '/api/resources/' || mr.resource_id::TEXT || '/pdf'
                ELSE mr.url
              END AS resolved_url
            FROM module_resources mr
            LEFT JOIN module_resource_files mrf ON mrf.resource_id = mr.resource_id
            ORDER BY mr.module_id, mr.order_no, mr.resource_id`;
}

function getModuleResourcesLegacySql() {
    return `SELECT
              mr.resource_id::INT AS resource_id,
              mr.module_id::INT AS module_id,
              mr.type,
              mr.title,
              mr.url,
              mr.order_no::INT AS order_no,
              NULL::INT AS file_id,
              NULL::TEXT AS original_filename,
              NULL::TEXT AS mime_type,
              NULL::BIGINT AS file_size,
              FALSE AS has_uploaded_file,
              mr.url AS resolved_url
            FROM module_resources mr
            ORDER BY mr.module_id, mr.order_no, mr.resource_id`;
}

function isUndefinedTableError(error, tableName) {
    return error?.code === "42P01" && String(error?.message || "").toLowerCase().includes(tableName.toLowerCase());
}

async function getModuleResourcesRowsSafe() {
    try {
        const result = await pool.query(getModuleResourcesWithFilesSql());
        return result.rows;
    } catch (error) {
        if (!isUndefinedTableError(error, "module_resource_files")) {
            throw error;
        }

        // Backward-compatible fallback for databases that have not applied module_resource_files migration yet.
        console.error("Dashboard resources query fallback: module_resource_files is missing", error);
        const legacyResult = await pool.query(getModuleResourcesLegacySql());
        return legacyResult.rows;
    }
}

function normalizeLessonTitle(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > LESSON_TITLE_MAX_LENGTH) return null;
    return trimmed;
}

function normalizeLessonResourceType(value) {
    const normalized = String(value || "")
        .trim()
        .toUpperCase();
    if (normalized === LESSON_RESOURCE_TYPE_PDF || normalized === LESSON_RESOURCE_TYPE_VIDEO) {
        return normalized;
    }
    return null;
}

function extractYouTubeVideoId(parsedUrl) {
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const pathSegments = parsedUrl.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (hostname === "youtu.be") {
        return pathSegments[0] || null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtube-nocookie.com") {
        if (parsedUrl.searchParams.get("v")) {
            return parsedUrl.searchParams.get("v");
        }

        if (pathSegments[0] === "embed" || pathSegments[0] === "shorts" || pathSegments[0] === "live") {
            return pathSegments[1] || null;
        }
    }

    return null;
}

function extractVimeoVideoId(parsedUrl) {
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") return null;

    const pathSegments = parsedUrl.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
        if (/^\d+$/.test(pathSegments[index])) {
            return pathSegments[index];
        }
    }
    return null;
}

function extractGoogleDriveFileId(parsedUrl) {
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "drive.google.com") return null;

    const pathSegments = parsedUrl.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
    if (
        pathSegments.length !== 4 ||
        pathSegments[0] !== "file" ||
        pathSegments[1] !== "d" ||
        (pathSegments[3] !== "preview" && pathSegments[3] !== "view")
    ) {
        return null;
    }

    const fileId = pathSegments[2] || "";
    return /^[A-Za-z0-9_-]+$/.test(fileId) ? fileId : null;
}

function normalizeVideoLessonUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return { url: null, error: "Video URL is required" };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(value.trim());
    } catch {
        return { url: null, error: "Video URL must be a valid URL" };
    }

    if (parsedUrl.protocol !== "https:") {
        return { url: null, error: "Video URL must use https" };
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const youTubeVideoId = extractYouTubeVideoId(parsedUrl);
    if (youTubeVideoId) {
        return { url: parsedUrl.toString(), error: null };
    }

    const vimeoVideoId = extractVimeoVideoId(parsedUrl);
    if (vimeoVideoId) {
        return { url: parsedUrl.toString(), error: null };
    }

    const googleDriveFileId = extractGoogleDriveFileId(parsedUrl);
    if (googleDriveFileId) {
        return {
            url: `https://drive.google.com/file/d/${encodeURIComponent(googleDriveFileId)}/preview`,
            error: null,
        };
    }

    const extension = path.extname(parsedUrl.pathname || "").toLowerCase();
    if (DIRECT_VIDEO_ALLOWED_EXTENSIONS.has(extension)) {
        return { url: parsedUrl.toString(), error: null };
    }

    return {
        url: null,
        error: "Video URL must be an https YouTube, Vimeo, Google Drive /preview or /view file link, MP4, or WebM link",
    };
}

function mapAdminLessonResourceRow(row) {
    const resourceId = Number(row.resource_id);
    const moduleId = Number(row.module_id);
    const type = normalizeLessonResourceType(row.type) || LESSON_RESOURCE_TYPE_PDF;
    const isPdfLesson = type === LESSON_RESOURCE_TYPE_PDF;
    const fallbackUrl = typeof row.url === "string" ? row.url.trim() : "";
    const resolvedFromRow = typeof row.resolved_url === "string" ? row.resolved_url.trim() : "";
    const resolvedUrl = resolvedFromRow || fallbackUrl || null;
    const hasUploadedFile = isPdfLesson && row.file_id != null;
    const derivedFileName = isPdfLesson ? row.original_filename || extractFileNameFromUrl(resolvedUrl || fallbackUrl) : null;

    return {
        resource_id: Number.isInteger(resourceId) && resourceId > 0 ? resourceId : 0,
        module_id: Number.isInteger(moduleId) && moduleId > 0 ? moduleId : 0,
        type,
        title: row.title || "",
        url: fallbackUrl || "",
        order_no: Number(row.order_no) || 0,
        has_uploaded_file: hasUploadedFile,
        file_id: hasUploadedFile ? Number(row.file_id) : null,
        file_name: derivedFileName || null,
        original_filename: isPdfLesson ? row.original_filename || null : null,
        mime_type: isPdfLesson ? row.mime_type || null : null,
        file_size: isPdfLesson && row.file_size != null ? Number(row.file_size) : null,
        uploaded_at: isPdfLesson && row.uploaded_at ? new Date(row.uploaded_at).toISOString() : null,
        resolved_url: resolvedUrl,
        view_url: resolvedUrl,
    };
}

async function getAdminLessonResourceRows(moduleId = null) {
    const result = await pool.query(
        `SELECT
           mr.resource_id::INT AS resource_id,
           mr.module_id::INT AS module_id,
           mr.type,
           mr.title,
           mr.url,
           mr.order_no::INT AS order_no,
           mrf.file_id::INT AS file_id,
           mrf.original_filename,
           mrf.mime_type,
           mrf.file_size,
           COALESCE(mrf.updated_at, mrf.created_at) AS uploaded_at,
           (mrf.file_id IS NOT NULL) AS has_uploaded_file,
           CASE
             WHEN mrf.file_id IS NOT NULL THEN '/api/resources/' || mr.resource_id::TEXT || '/pdf'
             ELSE mr.url
           END AS resolved_url
         FROM module_resources mr
         LEFT JOIN module_resource_files mrf ON mrf.resource_id = mr.resource_id
         WHERE ($1::BIGINT IS NULL OR mr.module_id = $1)
         ORDER BY mr.module_id, mr.order_no, mr.resource_id`,
        [moduleId]
    );

    return result.rows.map(mapAdminLessonResourceRow);
}

function findAdminLessonByResourceId(item, resourceId) {
    if (!item || !Array.isArray(item.lessons)) return null;
    const safeResourceId = Number(resourceId);
    if (!Number.isInteger(safeResourceId) || safeResourceId < 1) return null;
    return item.lessons.find((lesson) => Number(lesson.resource_id) === safeResourceId) || null;
}

async function getAdminLessonItems(moduleId = null) {
    const [moduleResult, lessonRows] = await Promise.all([
        pool.query(
            `SELECT
               m.module_id::INT AS module_id,
               m.module_code,
               m.title AS module_title,
               m.description,
               m.order_no::INT AS order_no,
               m.is_active
             FROM modules m
             WHERE ($1::BIGINT IS NULL OR m.module_id = $1)
             ORDER BY COALESCE(m.order_no, 2147483647), m.module_id`,
            [moduleId]
        ),
        getAdminLessonResourceRows(moduleId),
    ]);

    const lessonsByModuleId = new Map();
    for (const lesson of lessonRows) {
        const key = Number(lesson.module_id);
        if (!lessonsByModuleId.has(key)) lessonsByModuleId.set(key, []);
        lessonsByModuleId.get(key).push(lesson);
    }

    return moduleResult.rows.map((row) => {
        const safeModuleId = Number(row.module_id) || 0;
        const lessons = lessonsByModuleId.get(safeModuleId) || [];

        return {
            module_id: safeModuleId,
            module_code: row.module_code || "",
            module_title: row.module_title || "",
            description: row.description || null,
            order_no: Number(row.order_no) || 0,
            is_active: row.is_active === true,
            lessons,
        };
    });
}

async function getModuleStatusRowsForTrainee(traineeId) {
    const result = await pool.query(
        `SELECT module_id, module_code, module_title, required_sims, completed_required_sims, module_status
         FROM v_trainee_module_status
         WHERE trainee_id = $1
         ORDER BY module_id`,
        [traineeId]
    );
    return result.rows;
}

async function getDashboardPayloadForTrainee(traineeId) {
    const profile = await pool.query(
        `SELECT t.trainee_id, t.trainee_code, t.first_name, t.middle_name, t.last_name,
                t.email, t.contact_number, t.address, t.birth_date, b.batch_code
         FROM trainees t
         JOIN batches b ON b.batch_id = t.batch_id
         WHERE t.trainee_id = $1`,
        [traineeId]
    );

    if (profile.rows.length === 0) return null;

    const [moduleStatus, modules, resources, simulations, simulationProgress] = await Promise.all([
        pool.query(
            `SELECT module_id, module_code, module_title, required_sims, completed_required_sims, module_status
             FROM v_trainee_module_status
             WHERE trainee_id = $1
             ORDER BY module_id`,
            [traineeId]
        ),
        pool.query("SELECT * FROM modules ORDER BY order_no"),
        getModuleResourcesRowsSafe(),
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

    return {
        trainee: profile.rows[0],
        moduleStatus: moduleStatus.rows,
        moduleContent: {
            modules: modules.rows,
            resources,
            simulations: simulations.rows,
        },
        simulationProgress: simulationProgress.rows,
    };
}

async function completeSimulationForTrainee(traineeId, simulationId, bestScore) {
    const [traineeExists, simulationExists] = await Promise.all([
        pool.query("SELECT 1 FROM trainees WHERE trainee_id = $1", [traineeId]),
        pool.query("SELECT 1 FROM simulations WHERE simulation_id = $1", [simulationId]),
    ]);

    if (traineeExists.rowCount === 0) {
        return { error: "Trainee not found", status: 404 };
    }
    if (simulationExists.rowCount === 0) {
        return { error: "Simulation not found", status: 404 };
    }

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
    invalidateAdminCaches();

    return { ok: true };
}

app.get("/api/health", async (req, res) => {
    try {
        const r = await pool.query("SELECT NOW() as now");
        res.json({ ok: true, now: r.rows[0].now });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const client = await pool.connect();
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || typeof password !== "string" || password.length === 0) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const result = await client.query(
            `SELECT account_id, trainee_id, login_email, password_hash, is_active, role, is_system_protected
       FROM accounts
       WHERE lower(login_email) = $1
       LIMIT 1`,
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const account = result.rows[0];
        if (!account.is_active) {
            return res.status(403).json({ error: "Account is inactive" });
        }

        const passwordMatches = await bcrypt.compare(password, account.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const resolvedAccount = await resolveLoginAccountRole(client, Number(account.account_id));
        if (!resolvedAccount.is_active) {
            return res.status(403).json({ error: "Account is inactive" });
        }

        const role = roleFromAccountRow(resolvedAccount);
        const accountId = Number(resolvedAccount.account_id);
        const traineeId = resolvedAccount.trainee_id == null ? null : Number(resolvedAccount.trainee_id);
        const subject = traineeId ?? accountId;
        const payload = {
            sub: String(subject),
            role,
            account_id: accountId,
            ...(traineeId == null ? {} : { trainee_id: traineeId }),
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({
            token,
            role,
            sub: subject,
            account_id: accountId,
            trainee_id: traineeId,
        });
    } catch (e) {
        console.error("Login endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.use("/api/admin", requireAuth, requireAdmin);

app.get("/api/admin/auth-check", (req, res) => {
    res.json({
        ok: true,
        role: req.auth.role,
        sub: req.auth.sub,
        account_id: req.auth.account_id,
        trainee_id: req.auth.trainee_id ?? null,
    });
});

app.get("/api/admin/lessons", async (req, res) => {
    try {
        const items = await getAdminLessonItems();
        return res.json({ items });
    } catch (error) {
        console.error("Admin lessons listing endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/lessons", async (req, res) => {
    const rawTitle = req.body?.title;
    if (typeof rawTitle !== "string") {
        return res.status(400).json({ error: "Title is required" });
    }

    const title = rawTitle.trim();
    if (!title) {
        return res.status(400).json({ error: "Title cannot be empty" });
    }
    if (title.length > MODULE_TITLE_MAX_LENGTH) {
        return res.status(400).json({ error: `Title must be at most ${MODULE_TITLE_MAX_LENGTH} characters` });
    }

    const client = await pool.connect();
    let createdModuleId = null;
    let committed = false;

    try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE modules IN SHARE ROW EXCLUSIVE MODE");

        const nextOrderResult = await client.query(
            `SELECT COALESCE(MAX(order_no), 0)::INT + 1 AS next_order
             FROM modules`
        );
        const nextOrder = Number(nextOrderResult.rows[0]?.next_order) || 1;

        const existingCodesResult = await client.query(`SELECT module_code FROM modules`);
        const usedCodeNumbers = new Set();
        for (const row of existingCodesResult.rows) {
            const codeNumber = extractModuleCodeNumber(row.module_code);
            if (codeNumber) usedCodeNumbers.add(codeNumber);
        }

        let candidateCodeNumber = Math.max(nextOrder, 1);
        while (usedCodeNumbers.has(candidateCodeNumber)) {
            candidateCodeNumber += 1;
        }
        const moduleCode = formatModuleCodeFromNumber(candidateCodeNumber);

        const insertResult = await client.query(
            `INSERT INTO modules (module_code, title, order_no)
             VALUES ($1, $2, $3)
             RETURNING module_id`,
            [moduleCode, title, nextOrder]
        );

        createdModuleId = Number(insertResult.rows[0]?.module_id) || null;
        if (!createdModuleId) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to create module" });
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson create:", rollbackError);
            }
        }

        if (error?.code === "23505") {
            return res.status(409).json({ error: "Module code already exists" });
        }

        console.error("Admin lesson create endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }

    invalidateAdminCaches();
    try {
        const [item] = await getAdminLessonItems(createdModuleId);
        if (!item) {
            return res.status(500).json({ error: "Failed to load lesson after create" });
        }
        return res.status(201).json({ item });
    } catch (error) {
        console.error("Admin lesson create follow-up listing failed:", error);
        return res.status(201).json({ item: null });
    }
});

app.patch("/api/admin/lessons/:moduleId", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const rawTitle = req.body?.title;
    if (typeof rawTitle !== "string") {
        return res.status(400).json({ error: "Title is required" });
    }

    const title = rawTitle.trim();
    if (!title) {
        return res.status(400).json({ error: "Title cannot be empty" });
    }
    if (title.length > MODULE_TITLE_MAX_LENGTH) {
        return res.status(400).json({ error: `Title must be at most ${MODULE_TITLE_MAX_LENGTH} characters` });
    }

    try {
        const updateResult = await pool.query(
            `UPDATE modules
             SET title = $2
             WHERE module_id = $1
             RETURNING module_id`,
            [moduleId, title]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ error: "Module not found" });
        }

        invalidateAdminCaches();
        const [item] = await getAdminLessonItems(moduleId);
        if (!item) {
            return res.status(500).json({ error: "Failed to load lesson after update" });
        }

        return res.json({ item });
    } catch (error) {
        console.error("Admin lesson title update endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/modules/:moduleId/lessons", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    try {
        const [moduleItem] = await getAdminLessonItems(moduleId);
        if (!moduleItem) return res.status(404).json({ error: "Module not found" });
        return res.json({ module: moduleItem, lessons: moduleItem.lessons || [] });
    } catch (error) {
        console.error("Admin module lessons listing endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/modules/:moduleId/lessons", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const lessonBody =
        req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};

    const title = normalizeLessonTitle(lessonBody.title);
    if (!title) {
        return res.status(400).json({ error: `Lesson title is required and must be at most ${LESSON_TITLE_MAX_LENGTH} characters` });
    }

    const type = normalizeLessonResourceType(lessonBody.type) || LESSON_RESOURCE_TYPE_PDF;
    let lessonUrl = "";
    if (type === LESSON_RESOURCE_TYPE_VIDEO) {
        const normalizedVideoUrl = normalizeVideoLessonUrl(lessonBody.url ?? lessonBody.video_url);
        if (normalizedVideoUrl.error || !normalizedVideoUrl.url) {
            return res.status(400).json({ error: normalizedVideoUrl.error || "Video URL is required" });
        }
        lessonUrl = normalizedVideoUrl.url;
    }

    const client = await pool.connect();
    let createdResourceId = null;
    let committed = false;

    try {
        await client.query("BEGIN");

        const moduleResult = await client.query(
            `SELECT module_id
             FROM modules
             WHERE module_id = $1
             FOR UPDATE`,
            [moduleId]
        );
        if (moduleResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Module not found" });
        }

        const nextOrderResult = await client.query(
            `SELECT COALESCE(MAX(order_no), 0)::INT + 1 AS next_order
             FROM module_resources
             WHERE module_id = $1`,
            [moduleId]
        );
        const nextOrder = Number(nextOrderResult.rows[0]?.next_order) || 1;

        const insertResult = await client.query(
            `INSERT INTO module_resources (module_id, type, title, url, order_no)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING resource_id::INT AS resource_id`,
            [moduleId, type, title, lessonUrl, nextOrder]
        );
        createdResourceId = Number(insertResult.rows[0]?.resource_id) || null;
        if (!createdResourceId) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to create lesson" });
        }

        await client.query("COMMIT");
        committed = true;
        invalidateAdminCaches();
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson resource create:", rollbackError);
            }
        }
        console.error("Admin lesson resource create endpoint failed:", error);
        return res.status(500).json({ error: "Failed to create lesson" });
    } finally {
        client.release();
    }

    try {
        const [item] = await getAdminLessonItems(moduleId);
        const lesson = findAdminLessonByResourceId(item, createdResourceId);
        return res.status(201).json({ item: item || null, lesson: lesson || null });
    } catch (error) {
        console.error("Admin lesson resource create follow-up listing failed:", error);
        return res.status(201).json({ item: null, lesson: null });
    }
});

app.patch("/api/admin/modules/:moduleId/lessons/:resourceId", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    const resourceId = parsePositiveIntParam(req.params.resourceId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
    if (!resourceId) return res.status(400).json({ error: "Invalid resource id" });

    const lessonBody =
        req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};

    const hasTitle = Object.prototype.hasOwnProperty.call(lessonBody, "title");
    const hasOrderNo = Object.prototype.hasOwnProperty.call(lessonBody, "order_no");
    const hasType = Object.prototype.hasOwnProperty.call(lessonBody, "type");
    const hasUrl =
        Object.prototype.hasOwnProperty.call(lessonBody, "url") ||
        Object.prototype.hasOwnProperty.call(lessonBody, "video_url");
    if (!hasTitle && !hasOrderNo && !hasType && !hasUrl) {
        return res.status(400).json({ error: "At least one of title, order_no, type, or url is required" });
    }

    const title = hasTitle ? normalizeLessonTitle(lessonBody.title) : null;
    if (hasTitle && !title) {
        return res.status(400).json({ error: `Lesson title must be at most ${LESSON_TITLE_MAX_LENGTH} characters` });
    }

    const requestedType = hasType ? normalizeLessonResourceType(lessonBody.type) : null;
    if (hasType && !requestedType) {
        return res.status(400).json({ error: "Lesson type must be PDF or VIDEO" });
    }

    let requestedOrderNo = null;
    if (hasOrderNo) {
        const parsedOrder = Number(lessonBody.order_no);
        if (!Number.isInteger(parsedOrder) || parsedOrder < 1) {
            return res.status(400).json({ error: "order_no must be a positive integer" });
        }
        requestedOrderNo = parsedOrder;
    }

    const client = await pool.connect();
    const staleStorageKeys = new Set();
    let committed = false;

    try {
        await client.query("BEGIN");

        const lessonResult = await client.query(
            `SELECT resource_id::INT AS resource_id, type, url
             FROM module_resources
             WHERE module_id = $1
               AND resource_id = $2
             FOR UPDATE`,
            [moduleId, resourceId]
        );
        if (lessonResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Lesson not found" });
        }

        const currentLesson = lessonResult.rows[0];
        const currentType = normalizeLessonResourceType(currentLesson.type) || LESSON_RESOURCE_TYPE_PDF;
        const nextType = requestedType || currentType;
        const currentUrl = typeof currentLesson.url === "string" ? currentLesson.url.trim() : "";

        let nextUrl = currentUrl;
        if (nextType === LESSON_RESOURCE_TYPE_VIDEO) {
            if (hasUrl) {
                const normalizedVideoUrl = normalizeVideoLessonUrl(lessonBody.url ?? lessonBody.video_url);
                if (normalizedVideoUrl.error || !normalizedVideoUrl.url) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ error: normalizedVideoUrl.error || "Video URL is required" });
                }
                nextUrl = normalizedVideoUrl.url;
            } else if (requestedType === LESSON_RESOURCE_TYPE_VIDEO && currentType !== LESSON_RESOURCE_TYPE_VIDEO) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Video URL is required when changing lesson type to VIDEO" });
            } else if (!currentUrl) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Video lessons must have a valid video URL" });
            }
        } else {
            nextUrl = "";
        }

        if (hasTitle && title) {
            await client.query(
                `UPDATE module_resources
                 SET title = $2
                 WHERE resource_id = $1`,
                [resourceId, title]
            );
        }

        if (nextType !== currentType || nextUrl !== currentUrl) {
            await client.query(
                `UPDATE module_resources
                 SET type = $2,
                     url = $3
                 WHERE resource_id = $1`,
                [resourceId, nextType, nextUrl]
            );
        }

        if (nextType !== currentType) {
            const fileRowsResult = await client.query(
                `SELECT storage_key
                 FROM module_resource_files
                 WHERE resource_id = $1
                 FOR UPDATE`,
                [resourceId]
            );
            for (const row of fileRowsResult.rows) {
                if (row.storage_key) staleStorageKeys.add(row.storage_key);
            }
            await client.query(`DELETE FROM module_resource_files WHERE resource_id = $1`, [resourceId]);
        }

        if (requestedOrderNo !== null) {
            const orderedResourcesResult = await client.query(
                `SELECT resource_id::INT AS resource_id
                 FROM module_resources
                 WHERE module_id = $1
                 ORDER BY order_no ASC, resource_id ASC
                 FOR UPDATE`,
                [moduleId]
            );

            const orderedIds = orderedResourcesResult.rows
                .map((row) => Number(row.resource_id))
                .filter((value) => Number.isInteger(value) && value > 0);
            const currentIndex = orderedIds.indexOf(resourceId);
            if (currentIndex >= 0) {
                orderedIds.splice(currentIndex, 1);
                const targetIndex = Math.max(0, Math.min(requestedOrderNo - 1, orderedIds.length));
                orderedIds.splice(targetIndex, 0, resourceId);

                for (let index = 0; index < orderedIds.length; index += 1) {
                    await client.query(
                        `UPDATE module_resources
                         SET order_no = $2
                         WHERE resource_id = $1`,
                        [orderedIds[index], index + 1]
                    );
                }
            }
        }

        await client.query("COMMIT");
        committed = true;
        invalidateAdminCaches();
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson resource update:", rollbackError);
            }
        }
        console.error("Admin lesson resource update endpoint failed:", error);
        return res.status(500).json({ error: "Failed to update lesson" });
    } finally {
        client.release();
    }

    for (const key of staleStorageKeys.values()) {
        await removeStoredLessonPdf(key);
    }

    try {
        const [item] = await getAdminLessonItems(moduleId);
        const lesson = findAdminLessonByResourceId(item, resourceId);
        return res.json({ item: item || null, lesson: lesson || null });
    } catch (error) {
        console.error("Admin lesson resource update follow-up listing failed:", error);
        return res.json({ item: null, lesson: null });
    }
});

app.delete("/api/admin/modules/:moduleId/lessons/:resourceId", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    const resourceId = parsePositiveIntParam(req.params.resourceId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
    if (!resourceId) return res.status(400).json({ error: "Invalid resource id" });

    const client = await pool.connect();
    const staleStorageKeys = new Set();
    let committed = false;

    try {
        await client.query("BEGIN");

        const lessonResult = await client.query(
            `SELECT resource_id::INT AS resource_id
             FROM module_resources
             WHERE module_id = $1
               AND resource_id = $2
             FOR UPDATE`,
            [moduleId, resourceId]
        );
        if (lessonResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Lesson not found" });
        }

        const fileRowsResult = await client.query(
            `SELECT storage_key
             FROM module_resource_files
             WHERE resource_id = $1
             FOR UPDATE`,
            [resourceId]
        );
        for (const row of fileRowsResult.rows) {
            if (row.storage_key) staleStorageKeys.add(row.storage_key);
        }

        await client.query(`DELETE FROM module_resources WHERE resource_id = $1`, [resourceId]);

        const remainingResourcesResult = await client.query(
            `SELECT resource_id::INT AS resource_id
             FROM module_resources
             WHERE module_id = $1
             ORDER BY order_no ASC, resource_id ASC
             FOR UPDATE`,
            [moduleId]
        );
        const remainingIds = remainingResourcesResult.rows
            .map((row) => Number(row.resource_id))
            .filter((value) => Number.isInteger(value) && value > 0);
        for (let index = 0; index < remainingIds.length; index += 1) {
            await client.query(
                `UPDATE module_resources
                 SET order_no = $2
                 WHERE resource_id = $1`,
                [remainingIds[index], index + 1]
            );
        }

        await client.query("COMMIT");
        committed = true;
        invalidateAdminCaches();
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson resource delete:", rollbackError);
            }
        }
        console.error("Admin lesson resource delete endpoint failed:", error);
        return res.status(500).json({ error: "Failed to delete lesson" });
    } finally {
        client.release();
    }

    for (const key of staleStorageKeys.values()) {
        await removeStoredLessonPdf(key);
    }

    try {
        const [item] = await getAdminLessonItems(moduleId);
        return res.json({ item: item || null, removed: true });
    } catch (error) {
        console.error("Admin lesson resource delete follow-up listing failed:", error);
        return res.json({ item: null, removed: true });
    }
});

app.post("/api/admin/modules/:moduleId/lessons/:resourceId/pdf", (req, res) => {
    upload.single("file")(req, res, async (uploadError) => {
        if (uploadError) {
            if (uploadError.code === "LIMIT_FILE_SIZE") {
                return res
                    .status(400)
                    .json({ error: `PDF exceeds ${Math.floor(LESSON_PDF_MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit` });
            }
            return res.status(400).json({ error: "Invalid PDF upload" });
        }

        const moduleId = parsePositiveIntParam(req.params.moduleId);
        const resourceId = parsePositiveIntParam(req.params.resourceId);
        if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
        if (!resourceId) return res.status(400).json({ error: "Invalid resource id" });
        if (!req.file?.buffer) return res.status(400).json({ error: "PDF file is required" });

        const rawOriginalFilename = String(req.file.originalname || "").trim();
        const originalFilename = sanitizePdfOriginalFilename(rawOriginalFilename || `lesson-${resourceId}.pdf`);
        const mimeType = String(req.file.mimetype || "")
            .trim()
            .toLowerCase();
        const fileSize = Number(req.file.size) || req.file.buffer.length;

        if (!isPdfExtensionFileName(rawOriginalFilename || originalFilename)) {
            return res.status(400).json({ error: "Only .pdf files are allowed" });
        }
        if (!isAllowedPdfMimeType(mimeType)) {
            return res.status(400).json({ error: "Invalid PDF MIME type" });
        }
        if (!hasPdfMagicBytes(req.file.buffer)) {
            return res.status(400).json({ error: "Invalid PDF file signature" });
        }
        if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > LESSON_PDF_MAX_FILE_SIZE_BYTES) {
            return res
                .status(400)
                .json({ error: `PDF size must be between 1 byte and ${LESSON_PDF_MAX_FILE_SIZE_BYTES} bytes` });
        }

        const client = await pool.connect();
        const staleStorageKeys = new Set();
        let newStorageKey = null;
        let committed = false;

        try {
            await client.query("BEGIN");

            const lessonResult = await client.query(
                `SELECT resource_id::INT AS resource_id, type
                 FROM module_resources
                 WHERE module_id = $1
                   AND resource_id = $2
                 FOR UPDATE`,
                [moduleId, resourceId]
            );
            if (lessonResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Lesson not found" });
            }
            if (normalizeLessonResourceType(lessonResult.rows[0]?.type) !== LESSON_RESOURCE_TYPE_PDF) {
                await client.query("ROLLBACK");
                return res.status(400).json({ error: "Only PDF lessons can receive uploaded PDF files" });
            }

            const existingFileResult = await client.query(
                `SELECT storage_key
                 FROM module_resource_files
                 WHERE resource_id = $1
                 FOR UPDATE`,
                [resourceId]
            );
            for (const row of existingFileResult.rows) {
                if (row.storage_key) staleStorageKeys.add(row.storage_key);
            }

            const resourceViewPath = buildModuleResourcePdfViewPath(resourceId);
            await client.query(`UPDATE module_resources SET url = $2 WHERE resource_id = $1`, [resourceId, resourceViewPath]);

            const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
            newStorageKey = createLessonPdfStorageKey(moduleId);
            const newStoragePath = resolveLessonPdfStoragePath(newStorageKey);
            await ensureLessonUploadsDirectory();
            await fsPromises.writeFile(newStoragePath, req.file.buffer, { flag: "wx" });

            try {
                await client.query(
                    `INSERT INTO module_resource_files
                      (resource_id, storage_key, original_filename, mime_type, file_size, sha256)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (resource_id)
                     DO UPDATE SET
                       storage_key = EXCLUDED.storage_key,
                       original_filename = EXCLUDED.original_filename,
                       mime_type = EXCLUDED.mime_type,
                       file_size = EXCLUDED.file_size,
                       sha256 = EXCLUDED.sha256,
                       updated_at = NOW()`,
                    [resourceId, newStorageKey, originalFilename, mimeType || "application/pdf", fileSize, checksum]
                );
            } catch (dbUpsertError) {
                await removeStoredLessonPdf(newStorageKey);
                throw dbUpsertError;
            }

            await client.query("COMMIT");
            committed = true;
            invalidateAdminCaches();
        } catch (error) {
            if (!committed) {
                try {
                    await client.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error("Rollback failed during admin lesson PDF upload by resource:", rollbackError);
                }
            }
            if (newStorageKey && !committed) {
                await removeStoredLessonPdf(newStorageKey);
            }
            console.error("Admin lesson PDF upload-by-resource endpoint failed:", error);
            return res.status(500).json({ error: "Failed to upload lesson PDF" });
        } finally {
            client.release();
        }

        for (const key of staleStorageKeys.values()) {
            if (newStorageKey && key === newStorageKey) continue;
            await removeStoredLessonPdf(key);
        }

        try {
            const [item] = await getAdminLessonItems(moduleId);
            const lesson = findAdminLessonByResourceId(item, resourceId);
            return res.status(200).json({ item: item || null, lesson: lesson || null });
        } catch (listError) {
            console.error("Admin lesson PDF upload-by-resource follow-up listing failed:", listError);
            return res.status(200).json({ item: null, lesson: null });
        }
    });
});

app.delete("/api/admin/modules/:moduleId/lessons/:resourceId/pdf", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    const resourceId = parsePositiveIntParam(req.params.resourceId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
    if (!resourceId) return res.status(400).json({ error: "Invalid resource id" });

    const client = await pool.connect();
    const staleStorageKeys = new Set();
    let removed = false;
    let committed = false;

    try {
        await client.query("BEGIN");

        const lessonResult = await client.query(
            `SELECT resource_id::INT AS resource_id, type, url
             FROM module_resources
             WHERE module_id = $1
               AND resource_id = $2
             FOR UPDATE`,
            [moduleId, resourceId]
        );
        if (lessonResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Lesson not found" });
        }
        if (normalizeLessonResourceType(lessonResult.rows[0]?.type) !== LESSON_RESOURCE_TYPE_PDF) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Only PDF lessons have uploaded PDF files" });
        }

        const existingUrl = String(lessonResult.rows[0]?.url || "").trim();
        const fileRowsResult = await client.query(
            `SELECT storage_key
             FROM module_resource_files
             WHERE resource_id = $1
             FOR UPDATE`,
            [resourceId]
        );
        for (const row of fileRowsResult.rows) {
            if (row.storage_key) staleStorageKeys.add(row.storage_key);
        }

        await client.query(`DELETE FROM module_resource_files WHERE resource_id = $1`, [resourceId]);
        await client.query(`UPDATE module_resources SET url = $2 WHERE resource_id = $1`, [resourceId, ""]);

        removed = fileRowsResult.rowCount > 0 || existingUrl.length > 0;

        await client.query("COMMIT");
        committed = true;
        invalidateAdminCaches();
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson PDF delete by resource:", rollbackError);
            }
        }
        console.error("Admin lesson PDF delete-by-resource endpoint failed:", error);
        return res.status(500).json({ error: "Failed to remove lesson PDF" });
    } finally {
        client.release();
    }

    for (const key of staleStorageKeys.values()) {
        await removeStoredLessonPdf(key);
    }

    try {
        const [item] = await getAdminLessonItems(moduleId);
        const lesson = findAdminLessonByResourceId(item, resourceId);
        return res.json({ item: item || null, lesson: lesson || null, removed });
    } catch (listError) {
        console.error("Admin lesson PDF delete-by-resource follow-up listing failed:", listError);
        return res.json({ item: null, lesson: null, removed });
    }
});

app.post("/api/admin/lessons/:moduleId/pdf", (req, res) => {
    upload.single("file")(req, res, async (uploadError) => {
        if (uploadError) {
            if (uploadError.code === "LIMIT_FILE_SIZE") {
                return res
                    .status(400)
                    .json({ error: `PDF exceeds ${Math.floor(LESSON_PDF_MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB limit` });
            }
            return res.status(400).json({ error: "Invalid PDF upload" });
        }

        const moduleId = parsePositiveIntParam(req.params.moduleId);
        if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
        if (!req.file?.buffer) return res.status(400).json({ error: "PDF file is required" });

        const rawOriginalFilename = String(req.file.originalname || "").trim();
        const originalFilename = sanitizePdfOriginalFilename(rawOriginalFilename || `module-${moduleId}.pdf`);
        const mimeType = String(req.file.mimetype || "")
            .trim()
            .toLowerCase();
        const fileSize = Number(req.file.size) || req.file.buffer.length;

        if (!isPdfExtensionFileName(rawOriginalFilename || originalFilename)) {
            return res.status(400).json({ error: "Only .pdf files are allowed" });
        }
        if (!isAllowedPdfMimeType(mimeType)) {
            return res.status(400).json({ error: "Invalid PDF MIME type" });
        }
        if (!hasPdfMagicBytes(req.file.buffer)) {
            return res.status(400).json({ error: "Invalid PDF file signature" });
        }
        if (!Number.isInteger(fileSize) || fileSize < 1 || fileSize > LESSON_PDF_MAX_FILE_SIZE_BYTES) {
            return res
                .status(400)
                .json({ error: `PDF size must be between 1 byte and ${LESSON_PDF_MAX_FILE_SIZE_BYTES} bytes` });
        }

        const client = await pool.connect();
        const staleStorageKeys = new Set();
        let newStorageKey = null;
        let newStoragePath = null;
        let committed = false;

        try {
            await client.query("BEGIN");

            const moduleResult = await client.query(
                `SELECT module_id, module_code, title
                 FROM modules
                 WHERE module_id = $1
                 FOR UPDATE`,
                [moduleId]
            );

            if (moduleResult.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Module not found" });
            }

            const moduleRow = moduleResult.rows[0];
            const pdfResourceResult = await client.query(
                `SELECT
                   resource_id::INT AS resource_id,
                   module_id::INT AS module_id,
                   type,
                   title,
                   url,
                   order_no::INT AS order_no
                 FROM module_resources
                 WHERE module_id = $1
                   AND type = 'PDF'
                 ORDER BY order_no ASC, resource_id ASC
                 LIMIT 1
                 FOR UPDATE`,
                [moduleId]
            );

            let resourceId = null;
            if (pdfResourceResult.rowCount === 0) {
                const nextOrderResult = await client.query(
                    `SELECT COALESCE(MAX(order_no), 0)::INT + 1 AS next_order
                     FROM module_resources
                     WHERE module_id = $1`,
                    [moduleId]
                );
                const nextOrder = Number(nextOrderResult.rows[0]?.next_order) || 1;
                const resourceTitle = `${moduleRow.module_code} PDF Manual`;
                const insertResourceResult = await client.query(
                    `INSERT INTO module_resources (module_id, type, title, url, order_no)
                     VALUES ($1, 'PDF', $2, $3, $4)
                     RETURNING resource_id`,
                    [moduleId, resourceTitle, "", nextOrder]
                );
                resourceId = Number(insertResourceResult.rows[0]?.resource_id) || null;
            } else {
                resourceId = Number(pdfResourceResult.rows[0]?.resource_id) || null;

                if (resourceId) {
                    const existingFileResult = await client.query(
                        `SELECT
                           file_id::INT AS file_id,
                           resource_id::INT AS resource_id,
                           storage_key,
                           original_filename,
                           mime_type,
                           file_size,
                           sha256
                         FROM module_resource_files
                         WHERE resource_id = $1
                         FOR UPDATE`,
                        [resourceId]
                    );
                    for (const row of existingFileResult.rows) {
                        if (row.storage_key) staleStorageKeys.add(row.storage_key);
                    }
                }

                const duplicateResourcesResult = await client.query(
                    `SELECT resource_id::INT AS resource_id
                     FROM module_resources
                     WHERE module_id = $1
                       AND type = 'PDF'
                       AND resource_id <> $2
                     ORDER BY order_no ASC, resource_id ASC
                     FOR UPDATE`,
                    [moduleId, resourceId]
                );

                const extraResourceIds = duplicateResourcesResult.rows
                    .map((row) => Number(row.resource_id))
                    .filter((value) => Number.isInteger(value) && value > 0);

                if (extraResourceIds.length > 0) {
                    const extraFileRowsResult = await client.query(
                        `SELECT storage_key
                         FROM module_resource_files
                         WHERE resource_id = ANY($1::BIGINT[])
                         FOR UPDATE`,
                        [extraResourceIds]
                    );
                    for (const row of extraFileRowsResult.rows) {
                        if (row.storage_key) staleStorageKeys.add(row.storage_key);
                    }

                    await client.query(`DELETE FROM module_resources WHERE resource_id = ANY($1::BIGINT[])`, [extraResourceIds]);
                }
            }

            if (!resourceId) {
                await client.query("ROLLBACK");
                return res.status(500).json({ error: "Failed to resolve PDF resource" });
            }

            const resourceViewPath = buildModuleResourcePdfViewPath(resourceId);
            await client.query(`UPDATE module_resources SET url = $2 WHERE resource_id = $1`, [resourceId, resourceViewPath]);

            const checksum = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
            newStorageKey = createLessonPdfStorageKey(moduleId);
            newStoragePath = resolveLessonPdfStoragePath(newStorageKey);
            await ensureLessonUploadsDirectory();
            await fsPromises.writeFile(newStoragePath, req.file.buffer, { flag: "wx" });

            try {
                await client.query(
                    `INSERT INTO module_resource_files
                      (resource_id, storage_key, original_filename, mime_type, file_size, sha256)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (resource_id)
                     DO UPDATE SET
                       storage_key = EXCLUDED.storage_key,
                       original_filename = EXCLUDED.original_filename,
                       mime_type = EXCLUDED.mime_type,
                       file_size = EXCLUDED.file_size,
                       sha256 = EXCLUDED.sha256,
                       updated_at = NOW()`,
                    [resourceId, newStorageKey, originalFilename, mimeType || "application/pdf", fileSize, checksum]
                );
            } catch (dbUpsertError) {
                await removeStoredLessonPdf(newStorageKey);
                throw dbUpsertError;
            }

            await client.query("COMMIT");
            committed = true;
            invalidateAdminCaches();
        } catch (error) {
            if (!committed) {
                try {
                    await client.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error("Rollback failed during admin lesson PDF upload:", rollbackError);
                }
            }
            if (newStorageKey && !committed) {
                await removeStoredLessonPdf(newStorageKey);
            }
            console.error("Admin lesson PDF upload endpoint failed:", error);
            return res.status(500).json({ error: "Failed to upload lesson PDF" });
        } finally {
            client.release();
        }

        for (const key of staleStorageKeys.values()) {
            if (newStorageKey && key === newStorageKey) continue;
            await removeStoredLessonPdf(key);
        }

        try {
            const [item] = await getAdminLessonItems(moduleId);
            return res.status(200).json({ item: item || null });
        } catch (listError) {
            console.error("Admin lesson PDF upload follow-up listing failed:", listError);
            return res.status(200).json({ item: null });
        }
    });
});

app.delete("/api/admin/lessons/:moduleId/pdf", async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const client = await pool.connect();
    const staleStorageKeys = new Set();
    let committed = false;

    try {
        await client.query("BEGIN");

        const moduleResult = await client.query(
            `SELECT module_id
             FROM modules
             WHERE module_id = $1
             FOR UPDATE`,
            [moduleId]
        );
        if (moduleResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Module not found" });
        }

        const pdfResourcesResult = await client.query(
            `SELECT resource_id::INT AS resource_id
             FROM module_resources
             WHERE module_id = $1
               AND type = 'PDF'
             ORDER BY order_no ASC, resource_id ASC
             FOR UPDATE`,
            [moduleId]
        );

        if (pdfResourcesResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "No PDF resource found for module" });
        }

        const resourceIds = pdfResourcesResult.rows
            .map((row) => Number(row.resource_id))
            .filter((value) => Number.isInteger(value) && value > 0);
        const pdfFileRowsResult = await client.query(
            `SELECT storage_key
             FROM module_resource_files
             WHERE resource_id = ANY($1::BIGINT[])
             FOR UPDATE`,
            [resourceIds]
        );
        for (const row of pdfFileRowsResult.rows) {
            if (row.storage_key) staleStorageKeys.add(row.storage_key);
        }

        await client.query(`DELETE FROM module_resources WHERE resource_id = ANY($1::BIGINT[])`, [resourceIds]);
        await client.query("COMMIT");
        committed = true;
        invalidateAdminCaches();
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin lesson PDF delete:", rollbackError);
            }
        }
        console.error("Admin lesson PDF delete endpoint failed:", error);
        return res.status(500).json({ error: "Failed to remove lesson PDF" });
    } finally {
        client.release();
    }

    for (const key of staleStorageKeys.values()) {
        await removeStoredLessonPdf(key);
    }

    try {
        const [item] = await getAdminLessonItems(moduleId);
        return res.json({ item: item || null, removed: true });
    } catch (listError) {
        console.error("Admin lesson PDF delete follow-up listing failed:", listError);
        return res.json({ item: null, removed: true });
    }
});

/*
Cache verification:
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/dashboard" # first call X-Cache: MISS
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/dashboard" # repeated call X-Cache: HIT
After export/reset mutation, call dashboard again and X-Cache should be MISS.
*/
app.get("/api/admin/dashboard", async (req, res) => {
    const rawBatchCode = Array.isArray(req.query.batch_code) ? req.query.batch_code[0] : req.query.batch_code;
    const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim().toUpperCase() : "";
    if (batchCode && !validateBatchCodeFormat(batchCode)) {
        return res.status(400).json({ error: "batch_code must match YYYY-CTT## or YYYY-IMM##" });
    }

    const scopedBatchCode = batchCode || null;
    const cacheKey = `admin_dashboard|batch:${scopedBatchCode || "ALL"}`;
    const cachedPayload = cacheGet(adminDashboardCache, cacheKey);
    if (cachedPayload) {
        setCacheHeaders(res, "HIT", cacheKey);
        return res.json(cachedPayload);
    }

    setCacheHeaders(res, "MISS", cacheKey);

    try {
        const payload = await getOrCreateInflight(adminDashboardInflight, cacheKey, async () => {
            const summaryResult = await pool.query(
                `WITH scoped_trainees AS (
                   SELECT t.trainee_id
                   FROM trainees t
                   JOIN batches b ON b.batch_id = t.batch_id
                   WHERE ($1::TEXT IS NULL OR b.batch_code = $1)
                 ),
                 scoped_module_rows AS (
                   SELECT
                     COALESCE(v.required_sims, 0)::INT AS required_sims,
                     COALESCE(v.completed_required_sims, 0)::INT AS completed_required_sims
                   FROM v_trainee_module_status v
                   JOIN scoped_trainees st ON st.trainee_id = v.trainee_id
                 ),
                 summary_stats AS (
                   SELECT
                     COALESCE((SELECT COUNT(*)::INT FROM scoped_trainees), 0)::INT AS total_trainees,
                     COALESCE((SELECT COUNT(*)::INT FROM modules), 0)::INT AS total_modules,
                     COALESCE(
                       (
                         SELECT COUNT(*) FILTER (
                           -- Completion rule: a module row is complete when all required sims are complete.
                           -- This matches the v_trainee_module_status view semantics and stays resilient
                           -- even if module_status label strings change in the future.
                           WHERE completed_required_sims >= required_sims
                         )::INT
                         FROM scoped_module_rows
                       ),
                       0
                     )::INT AS completed_module_rows,
                     COALESCE((SELECT COUNT(*)::INT FROM scoped_module_rows), 0)::INT AS total_module_rows
                 )
                 SELECT
                   summary_stats.total_trainees,
                   summary_stats.total_modules,
                   summary_stats.completed_module_rows,
                   summary_stats.total_module_rows,
                   CASE
                     WHEN summary_stats.total_module_rows = 0 THEN 0
                     ELSE ROUND(
                       (100.0 * summary_stats.completed_module_rows::NUMERIC) / summary_stats.total_module_rows::NUMERIC
                     )::INT
                   END AS progress_percent
                 FROM summary_stats`,
                [scopedBatchCode]
            );

            const chartResult = await pool.query(
                `WITH scoped_trainees AS (
                   SELECT t.trainee_id
                   FROM trainees t
                   JOIN batches b ON b.batch_id = t.batch_id
                   WHERE ($1::TEXT IS NULL OR b.batch_code = $1)
                 ),
                 module_completion AS (
                   SELECT
                     v.module_id,
                     COUNT(*)::INT AS total_trainees,
                     COUNT(*) FILTER (
                       -- Completion rule mirrors summary above: required sims fully completed.
                       WHERE COALESCE(v.completed_required_sims, 0) >= COALESCE(v.required_sims, 0)
                     )::INT AS completed_trainees
                   FROM v_trainee_module_status v
                   JOIN scoped_trainees st ON st.trainee_id = v.trainee_id
                   GROUP BY v.module_id
                 )
                 SELECT
                   m.module_id::INT AS module_id,
                   m.module_code,
                   m.title AS module_title,
                   COALESCE(mc.completed_trainees, 0)::INT AS completed_trainees,
                   COALESCE(mc.total_trainees, 0)::INT AS total_trainees,
                   CASE
                     WHEN COALESCE(mc.total_trainees, 0) = 0 THEN 0
                     ELSE ROUND((100.0 * mc.completed_trainees::NUMERIC) / mc.total_trainees::NUMERIC)::INT
                   END AS completion_percent
                 FROM modules m
                 LEFT JOIN module_completion mc ON mc.module_id = m.module_id
                 ORDER BY COALESCE(m.order_no, 2147483647), m.module_id`,
                [scopedBatchCode]
            );

            const activityFeed = await fetchAdminActivityLogs({ batchCode: scopedBatchCode, limit: 8 });

            const summaryRow = summaryResult.rows[0] || {};
            const completedModuleRows = Number(summaryRow.completed_module_rows) || 0;
            const totalModuleRows = Number(summaryRow.total_module_rows) || 0;
            const progressPercent = Number(summaryRow.progress_percent) || 0;

            const points = chartResult.rows.map((row) => {
                const completedTrainees = Number(row.completed_trainees) || 0;
                const totalTrainees = Number(row.total_trainees) || 0;
                const completionPercent =
                    totalTrainees === 0 ? 0 : Number.isFinite(Number(row.completion_percent)) ? Number(row.completion_percent) : 0;

                return {
                    module_id: Number(row.module_id) || 0,
                    module_code: row.module_code || "",
                    module_title: row.module_title || "",
                    completed_trainees: completedTrainees,
                    total_trainees: totalTrainees,
                    completion_percent: completionPercent,
                };
            });

            const events = activityFeed.items.map((item) => ({
                type: item.type || "event",
                occurred_at: item.occurred_at,
                batch_code: item.batch_code,
                actor: item.actor,
                message: item.message,
            }));

            const responseBody = {
                generated_at: new Date().toISOString(),
                scope: { batch_code: scopedBatchCode },
                summary: {
                    total_trainees: Number(summaryRow.total_trainees) || 0,
                    total_modules: Number(summaryRow.total_modules) || 0,
                    progress_percent: progressPercent,
                    completed_module_rows: completedModuleRows,
                    total_module_rows: totalModuleRows,
                },
                chart: {
                    kind: "module_completion_percent",
                    points,
                },
                notifications: events,
                activities: events,
            };

            cacheSet(adminDashboardCache, cacheKey, responseBody, DASHBOARD_CACHE_TTL_MS);
            return responseBody;
        });

        return res.json(payload);
    } catch (error) {
        console.error("Admin dashboard endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/*
Cache verification:
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/activity-logs?limit=8" # MISS then HIT
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/activity-logs?limit=8" # repeated call should HIT
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/activity-logs?mode=trainee_progress&search=lee" # trainee progress mode
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/activity-logs?before=2026-02-26T00:00:00.000Z" # legacy date cursor still works
curl -i -H "Authorization: Bearer <TOKEN>" "http://localhost:4000/api/admin/activity-logs?batch_code=BAD-CODE" # 400 invalid format
*/
app.get("/api/admin/activity-logs", async (req, res) => {
    try {
        const rawMode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
        const mode = normalizeAdminActivityLogsMode(rawMode);

        const rawBatchCode = Array.isArray(req.query.batch_code) ? req.query.batch_code[0] : req.query.batch_code;
        const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim().toUpperCase() : "";
        if (batchCode && !validateBatchCodeFormat(batchCode)) {
            return res.status(400).json({ error: "Invalid batch_code format" });
        }
        const scopedBatchCode = batchCode || null;

        const rawSearch = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
        const normalizedSearch = mode === "trainee_progress" ? normalizeAdminActivityLogsSearch(rawSearch) : "";
        const scopedSearch = normalizedSearch || null;

        const rawBefore = Array.isArray(req.query.before) ? req.query.before[0] : req.query.before;
        const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        const normalizedLimit = normalizeAdminActivityLogsLimit(rawLimit);
        const hasBeforeCursor = typeof rawBefore === "string" && rawBefore.trim() !== "";
        const cacheKey = `admin_activity_logs|mode:${mode}|batch:${scopedBatchCode || "ALL"}|search:${scopedSearch || "-"}|limit:${normalizedLimit}`;

        if (!hasBeforeCursor) {
            const cachedPayload = cacheGet(adminActivityLogsCache, cacheKey);
            if (cachedPayload) {
                setCacheHeaders(res, "HIT", cacheKey);
                return res.json(cachedPayload);
            }
        }

        setCacheHeaders(res, "MISS", hasBeforeCursor ? `${cacheKey}|before_cursor` : cacheKey);

        if (!hasBeforeCursor) {
            const payload = await getOrCreateInflight(adminActivityLogsInflight, cacheKey, async () => {
                const feed = await fetchAdminActivityLogs({
                    mode,
                    batchCode: scopedBatchCode,
                    limit: normalizedLimit,
                    search: scopedSearch || "",
                });

                const responseBody = {
                    generated_at: new Date().toISOString(),
                    scope: {
                        mode,
                        batch_code: scopedBatchCode,
                        search: scopedSearch,
                    },
                    paging: {
                        limit: feed.limit,
                        next_before: feed.next_before,
                    },
                    items: feed.items,
                };

                cacheSet(adminActivityLogsCache, cacheKey, responseBody, ACTIVITYLOGS_CACHE_TTL_MS);
                return responseBody;
            });

            return res.json(payload);
        }

        const feed = await fetchAdminActivityLogs({
            mode,
            batchCode: scopedBatchCode,
            limit: normalizedLimit,
            before: rawBefore,
            search: scopedSearch || "",
        });

        return res.json({
            generated_at: new Date().toISOString(),
            scope: {
                mode,
                batch_code: scopedBatchCode,
                search: scopedSearch,
            },
            paging: {
                limit: feed.limit,
                next_before: feed.next_before,
            },
            items: feed.items,
        });
    } catch (error) {
        if (error?.statusCode === 400) {
            return res.status(400).json({ error: error.message || "Invalid before cursor" });
        }
        console.error("Admin activity logs endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/batches", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.batch_id,
                    b.batch_code,
                    COUNT(t.trainee_id)::INT AS trainee_count,
                    exports.last_export_at,
                    resets.last_reset_at
             FROM batches b
             LEFT JOIN trainees t ON t.batch_id = b.batch_id
             LEFT JOIN (
               SELECT
                 batch_code,
                 MAX(exported_at) AS last_export_at
               FROM batch_exports
               GROUP BY batch_code
             ) exports ON exports.batch_code = b.batch_code
             LEFT JOIN (
               SELECT
                 batch_code,
                 MAX(reset_at) AS last_reset_at
               FROM system_resets
               GROUP BY batch_code
             ) resets ON resets.batch_code = b.batch_code
             GROUP BY b.batch_id, b.batch_code, exports.last_export_at, resets.last_reset_at
             ORDER BY b.batch_code DESC`
        );
        res.json({ items: result.rows });
    } catch (e) {
        console.error("Admin batches endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/batches", async (req, res) => {
    const rawBatchCode = req.body?.batch_code;
    const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim().toUpperCase() : "";
    if (!batchCode) {
        return res.status(400).json({ error: "batch_code is required" });
    }
    if (!validateBatchCodeFormat(batchCode)) {
        return res.status(400).json({ error: "batch_code must match YYYY-CTT## or YYYY-IMM##" });
    }

    try {
        const result = await pool.query(
            `INSERT INTO batches (batch_code)
             VALUES ($1)
             RETURNING batch_id, batch_code`,
            [batchCode]
        );

        return res.status(201).json({ item: result.rows[0] });
    } catch (error) {
        if (error?.code === "23505") {
            return res.status(409).json({ error: "Batch code already exists" });
        }
        console.error("Admin create batch endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/trainees/export-csv", async (req, res) => {
    try {
        const rawBatchCode = Array.isArray(req.query.batch_code) ? req.query.batch_code[0] : req.query.batch_code;
        const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim() : "";

        const values = [];
        let whereSql = "";
        if (batchCode) {
            values.push(batchCode);
            whereSql = `WHERE b.batch_code = $1`;
        }

        const result = await pool.query(
            `SELECT
               t.trainee_id,
               t.trainee_code,
               t.first_name,
               t.middle_name,
               t.last_name,
               t.email,
               t.contact_number,
               b.batch_id,
               b.batch_code,
               a.is_active,
               COALESCE(progress.completed_modules, 0)::INT AS completed_modules,
               COALESCE(progress.total_modules, 0)::INT AS total_modules
             FROM trainees t
             JOIN accounts a ON a.trainee_id = t.trainee_id
             JOIN batches b ON b.batch_id = t.batch_id
             LEFT JOIN (
               SELECT
                 trainee_id,
                 COUNT(*)::INT AS total_modules,
                 COUNT(*) FILTER (WHERE module_status = 'COMPLETED')::INT AS completed_modules
               FROM v_trainee_module_status
               GROUP BY trainee_id
             ) progress ON progress.trainee_id = t.trainee_id
             ${whereSql}
             ORDER BY b.batch_code, t.trainee_code, t.trainee_id`,
            values
        );

        const lines = [
            buildCsvRow([
                "batch_code",
                "trainee_code",
                "first_name",
                "middle_name",
                "last_name",
                "email",
                "contact_number",
                "status",
                "progress_percent",
                "progress_label",
            ]),
        ];

        for (const row of result.rows) {
            const item = mapAdminTraineeRowToItem(row);
            lines.push(
                buildCsvRow([
                    item.batch.batch_code,
                    item.trainee_code,
                    item.first_name,
                    item.middle_name,
                    item.last_name,
                    item.email,
                    item.contact_number,
                    item.status,
                    item.progress.percent,
                    item.progress.label,
                ])
            );
        }

        const filenameSuffix = batchCode || "all";
        const csvContent = `${lines.join("\n")}\n`;
        const exportBatchCode = batchCode || "ALL";
        const exportFileName = `batch_${toSafeFileToken(exportBatchCode) || "all"}_${formatTimestampForFileName()}.csv`;

        await pool.query(
            `INSERT INTO batch_exports
              (exported_by_account_id, batch_code, rows_exported, file_name)
             VALUES ($1, $2, $3, $4)`,
            [req.auth.account_id, exportBatchCode, result.rows.length, exportFileName]
        );
        invalidateAdminCaches();

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=\"trainees-${filenameSuffix}.csv\"`);
        res.status(200).send(csvContent);
    } catch (e) {
        console.error("Admin trainees export endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/reports/module-status.csv", async (req, res) => {
    const rawBatchCode = Array.isArray(req.query.batch_code) ? req.query.batch_code[0] : req.query.batch_code;
    const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim().toUpperCase() : "";
    if (!batchCode) {
        return res.status(400).json({ error: "batch_code is required" });
    }
    if (!validateBatchCodeFormat(batchCode)) {
        return res.status(400).json({ error: "batch_code must match YYYY-CTT## or YYYY-IMM##" });
    }

    try {
        const result = await pool.query(
            `SELECT
               b.batch_code,
               t.trainee_code,
               t.first_name,
               t.middle_name,
               t.last_name,
               module_status.module_code,
               module_status.module_title,
               module_status.module_status,
               module_status.required_sims,
               module_status.completed_required_sims
             FROM trainees t
             JOIN batches b ON b.batch_id = t.batch_id
             JOIN v_trainee_module_status module_status ON module_status.trainee_id = t.trainee_id
             LEFT JOIN modules m ON m.module_id = module_status.module_id
             WHERE b.batch_code = $1
             ORDER BY t.trainee_code ASC, COALESCE(m.order_no, 2147483647) ASC, module_status.module_code ASC`,
            [batchCode]
        );

        const lines = [
            buildCsvRow([
                "batch_code",
                "trainee_code",
                "trainee_name",
                "module_code",
                "module_title",
                "module_status",
                "required_sims",
                "completed_required_sims",
            ]),
        ];

        for (const row of result.rows) {
            lines.push(
                buildCsvRow([
                    row.batch_code,
                    row.trainee_code,
                    buildTraineeFullName(row),
                    row.module_code,
                    row.module_title,
                    row.module_status,
                    row.required_sims,
                    row.completed_required_sims,
                ])
            );
        }

        const csvContent = `${lines.join("\n")}\n`;
        const fileName = `module-status_${toSafeFileToken(batchCode) || "batch"}_${formatTimestampForMinuteFileName()}.csv`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        return res.status(200).send(csvContent);
    } catch (error) {
        console.error("Admin module status export endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/system/reset", async (req, res) => {
    const rawBatchCode = req.body?.batch_code;
    const batchCode = typeof rawBatchCode === "string" ? rawBatchCode.trim() : "";
    if (!batchCode) {
        return res.status(400).json({ error: "batch_code is required" });
    }

    const rawConfirmText = req.body?.confirm_text;
    if (typeof rawConfirmText !== "string") {
        return res.status(400).json({ error: "confirm_text is required" });
    }

    const expectedConfirm = `RESET ${batchCode}`;
    if (rawConfirmText !== expectedConfirm) {
        return res.status(400).json({ error: `Invalid confirmation. Expected "${expectedConfirm}"` });
    }

    if (req.body?.wipe_batch_record !== undefined && typeof req.body?.wipe_batch_record !== "boolean") {
        return res.status(400).json({ error: "wipe_batch_record must be a boolean" });
    }
    if (req.body?.force !== undefined && typeof req.body?.force !== "boolean") {
        return res.status(400).json({ error: "force must be a boolean" });
    }

    const wipeBatchRecord = req.body?.wipe_batch_record === true;
    const force = req.body?.force === true;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('system_reset'))");

        const batchResult = await client.query(
            `SELECT batch_id, batch_code
             FROM batches
             WHERE batch_code = $1
             LIMIT 1
             FOR UPDATE`,
            [batchCode]
        );
        if (batchResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Batch not found" });
        }

        const batch = batchResult.rows[0];
        const batchId = Number(batch.batch_id);

        let exportGateRequired = false;
        let lastExportAt = null;

        const exportTableResult = await client.query(`SELECT to_regclass('public.batch_exports') AS table_name`);
        if (exportTableResult.rows[0]?.table_name) {
            exportGateRequired = true;
            const latestExportResult = await client.query(
                `SELECT MAX(exported_at) AS last_export_at
                 FROM batch_exports
                 WHERE batch_code = $1`,
                [batch.batch_code]
            );
            lastExportAt = latestExportResult.rows[0]?.last_export_at ?? null;

            if (!force) {
                const hasRecentExportResult = await client.query(
                    `SELECT EXISTS(
                       SELECT 1
                       FROM batch_exports
                       WHERE batch_code = $1
                         AND exported_at >= NOW() - INTERVAL '24 hours'
                     ) AS has_recent`,
                    [batch.batch_code]
                );
                if (hasRecentExportResult.rows[0]?.has_recent !== true) {
                    await client.query("ROLLBACK");
                    return res.status(412).json({
                        error: "Recent batch export (within 24h) is required before reset unless force=true.",
                    });
                }
            }
        }

        const traineeIdsResult = await client.query(
            `SELECT trainee_id
             FROM trainees
             WHERE batch_id = $1
             ORDER BY trainee_id`,
            [batchId]
        );
        const traineeIds = traineeIdsResult.rows
            .map((row) => Number(row.trainee_id))
            .filter((value) => Number.isInteger(value) && value > 0);

        let deletedProgressRows = 0;
        let deletedTraineeAccounts = 0;
        let deletedTrainees = 0;

        if (traineeIds.length > 0) {
            const progressDeleteResult = await client.query(
                `DELETE FROM trainee_simulation_progress
                 WHERE trainee_id = ANY($1::BIGINT[])`,
                [traineeIds]
            );
            deletedProgressRows = progressDeleteResult.rowCount || 0;

            const traineeAccountsDeleteResult = await client.query(
                `DELETE FROM accounts
                 WHERE trainee_id = ANY($1::BIGINT[])
                   AND role = 'trainee'
                   AND is_system_protected = FALSE`,
                [traineeIds]
            );
            deletedTraineeAccounts = traineeAccountsDeleteResult.rowCount || 0;

            const traineesDeleteResult = await client.query(
                `DELETE FROM trainees
                 WHERE trainee_id = ANY($1::BIGINT[])`,
                [traineeIds]
            );
            deletedTrainees = traineesDeleteResult.rowCount || 0;
        }

        let deletedBatches = 0;
        if (wipeBatchRecord) {
            const batchDeleteResult = await client.query(
                `DELETE FROM batches
                 WHERE batch_id = $1`,
                [batchId]
            );
            deletedBatches = batchDeleteResult.rowCount || 0;
        }

        const preservedAdminsResult = await client.query(
            `SELECT COUNT(*)::INT AS count
             FROM accounts
             WHERE role = 'admin' OR is_system_protected = TRUE`
        );
        const preservedAdmins = Number(preservedAdminsResult.rows[0]?.count) || 0;
        if (preservedAdmins === 0) {
            throw new Error("Safety check failed: no admin/protected account remains after reset.");
        }

        const resetAuditResult = await client.query(
            `INSERT INTO system_resets
              (reset_by_account_id, batch_code, deleted_progress_rows, deleted_trainee_accounts, deleted_trainees, deleted_batches, forced)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING reset_at`,
            [
                req.auth.account_id,
                batch.batch_code,
                deletedProgressRows,
                deletedTraineeAccounts,
                deletedTrainees,
                deletedBatches,
                force,
            ]
        );
        const resetAt = resetAuditResult.rows[0]?.reset_at ?? new Date();

        await client.query("COMMIT");
        invalidateAdminCaches();
        return res.json({
            ok: true,
            batch_code: batch.batch_code,
            deleted: {
                progress_rows: deletedProgressRows,
                trainee_accounts: deletedTraineeAccounts,
                trainees: deletedTrainees,
                batches: deletedBatches,
            },
            preserved_admins: preservedAdmins,
            export_gate: {
                required: exportGateRequired,
                last_export_at: lastExportAt ? new Date(lastExportAt).toISOString() : null,
                forced: force,
            },
            reset_at: new Date(resetAt).toISOString(),
        });
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Admin system reset endpoint failed:", e);
        return res.status(500).json({ error: e?.message || "Internal server error" });
    } finally {
        client.release();
    }
});

app.post("/api/admin/trainees/import-csv", (req, res) => {
    upload.single("file")(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({ error: "Invalid CSV upload" });
        }

        const rawBatchCode = Array.isArray(req.body?.batch_code) ? req.body.batch_code[0] : req.body?.batch_code;
        const batchCode = sanitizeOptionalString(rawBatchCode);
        if (!batchCode) return res.status(400).json({ error: "batch_code is required" });

        const rawMode = Array.isArray(req.body?.mode) ? req.body.mode[0] : req.body?.mode;
        const mode = rawMode ? String(rawMode).trim() : "append";
        if (mode !== "append" && mode !== "replace_old_batches") {
            return res.status(400).json({ error: "Invalid mode" });
        }
        if (mode === "replace_old_batches") {
            const rawConfirm = Array.isArray(req.body?.confirm) ? req.body.confirm[0] : req.body?.confirm;
            const confirm = sanitizeOptionalString(rawConfirm);
            const expectedConfirm = `PURGE ${batchCode}`;
            if (confirm !== expectedConfirm) {
                return res.status(400).json({ error: `Invalid confirmation. Expected "${expectedConfirm}"` });
            }
        }

        if (!req.file?.buffer) {
            return res.status(400).json({ error: "CSV file is required" });
        }

        if (!DEFAULT_TRAINEE_PASSWORD) {
            return res.status(500).json({ error: "DEFAULT_TRAINEE_PASSWORD is not configured" });
        }

        let parsedCsv;
        try {
            parsedCsv = parseCsvRecordsFromBuffer(req.file.buffer);
        } catch (parseError) {
            return res.status(400).json({ error: "Invalid CSV content" });
        }

        if (parsedCsv.error) {
            return res.status(400).json({ error: parsedCsv.error });
        }

        const rows = parsedCsv.rows;
        const summary = {
            processed: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
        };
        const row_errors = [];

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const batch = await ensureBatchByCode(client, batchCode);
            let nextSeq = await lockBatchAndGetNextSequence(client, batch.batch_code);
            const defaultPasswordHash = await bcrypt.hash(DEFAULT_TRAINEE_PASSWORD, 10);

            for (const row of rows) {
                summary.processed += 1;

                if (!row.first_name || !row.last_name || !row.email) {
                    summary.skipped += 1;
                    summary.errors += 1;
                    row_errors.push({
                        row: row.row,
                        email: row.email || "",
                        error: "Missing required first_name, last_name, or email",
                    });
                    continue;
                }

                if (!validateEmailFormat(row.email)) {
                    summary.skipped += 1;
                    summary.errors += 1;
                    row_errors.push({
                        row: row.row,
                        email: row.email,
                        error: "Invalid email format",
                    });
                    continue;
                }

                const normalizedEmail = normalizeEmail(row.email);
                const existing = await findTraineeByEmail(client, normalizedEmail);

                if (existing) {
                    if (Number(existing.batch_id) !== Number(batch.batch_id) && mode !== "replace_old_batches") {
                        summary.skipped += 1;
                        summary.errors += 1;
                        row_errors.push({
                            row: row.row,
                            email: normalizedEmail,
                            error: "Email exists in different batch",
                        });
                        continue;
                    }

                    await client.query(
                        `UPDATE trainees
                         SET batch_id = $2,
                             first_name = $3,
                             middle_name = $4,
                             last_name = $5,
                             email = $6,
                             contact_number = $7
                         WHERE trainee_id = $1`,
                        [
                            existing.trainee_id,
                            batch.batch_id,
                            row.first_name,
                            row.middle_name,
                            row.last_name,
                            normalizedEmail,
                            row.contact_number,
                        ]
                    );

                    const accountUpdate = await client.query(
                        `UPDATE accounts
                         SET login_email = $2
                         WHERE trainee_id = $1
                         RETURNING trainee_id`,
                        [existing.trainee_id, normalizedEmail]
                    );

                    if (accountUpdate.rowCount === 0) {
                        summary.skipped += 1;
                        summary.errors += 1;
                        row_errors.push({
                            row: row.row,
                            email: normalizedEmail,
                            error: "Account not found",
                        });
                        continue;
                    }

                    summary.updated += 1;
                    continue;
                }

                const traineeCode = `${batch.batch_code}-${String(nextSeq).padStart(4, "0")}`;
                nextSeq += 1;

                try {
                    await createTraineeAndAccount(client, {
                        batch_id: batch.batch_id,
                        trainee_code: traineeCode,
                        first_name: row.first_name,
                        middle_name: row.middle_name,
                        last_name: row.last_name,
                        email: normalizedEmail,
                        contact_number: row.contact_number,
                        address: null,
                        birth_date: null,
                        password_hash: defaultPasswordHash,
                    });
                    summary.created += 1;
                } catch (rowError) {
                    if (rowError?.code === "23505") {
                        summary.skipped += 1;
                        summary.errors += 1;
                        row_errors.push({
                            row: row.row,
                            email: normalizedEmail,
                            error: getConflictErrorMessage(rowError),
                        });
                        continue;
                    }
                    throw rowError;
                }
            }

            if (mode === "replace_old_batches") {
                const purgeResult = await deleteTraineesWithSafety(client, "WHERE batch_id <> $1", [batch.batch_id]);
                if (purgeResult.error) {
                    await client.query("ROLLBACK");
                    return res.status(409).json({ error: purgeResult.error });
                }
            }

            await client.query("COMMIT");
            invalidateAdminCaches();
            res.json({
                batch: {
                    batch_id: String(batch.batch_id),
                    batch_code: batch.batch_code,
                },
                summary,
                row_errors,
            });
        } catch (e) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed:", rollbackError);
            }

            if (e?.code === "23505") {
                return res.status(409).json({ error: getConflictErrorMessage(e) });
            }

            console.error("Admin CSV import endpoint failed:", e);
            res.status(500).json({ error: "Internal server error" });
        } finally {
            client.release();
        }
    });
});

app.delete("/api/admin/batches/:batchId/trainees", async (req, res) => {
    const batchId = parsePositiveIntParam(req.params.batchId);
    if (!batchId) return res.status(400).json({ error: "Invalid batchId" });

    const rawConfirm = Array.isArray(req.body?.confirm) ? req.body.confirm[0] : req.body?.confirm;
    const confirm = sanitizeOptionalString(rawConfirm);
    if (!confirm) return res.status(400).json({ error: "confirm is required" });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const batchResult = await client.query(
            `SELECT batch_id, batch_code
             FROM batches
             WHERE batch_id = $1`,
            [batchId]
        );
        if (batchResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Batch not found" });
        }

        const batch = batchResult.rows[0];
        const expectedConfirm = `PURGE ${batch.batch_code}`;
        if (confirm !== expectedConfirm) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `Invalid confirmation. Expected "${expectedConfirm}"` });
        }

        const purgeResult = await deleteTraineesWithSafety(client, "WHERE batch_id = $1", [batchId]);
        if (purgeResult.error) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: purgeResult.error });
        }

        await client.query("COMMIT");
        invalidateAdminCaches();
        res.json({ ok: true, deleted_trainees: purgeResult.deleted });
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }

        console.error("Admin purge batch endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.get("/api/admin/trainees", async (req, res) => {
    try {
        const rawStatus = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
        const statusFilter = String(rawStatus ?? "all")
            .trim()
            .toLowerCase();
        if (!["all", "active", "inactive"].includes(statusFilter)) {
            return res.status(400).json({ error: "Invalid status filter" });
        }

        const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
        let limit = 25;
        if (rawLimit !== undefined) {
            const parsedLimit = parsePositiveIntParam(rawLimit);
            if (parsedLimit === null) return res.status(400).json({ error: "Invalid limit" });
            limit = Math.min(parsedLimit, 100);
        }

        const rawOffset = Array.isArray(req.query.offset) ? req.query.offset[0] : req.query.offset;
        let offset = 0;
        if (rawOffset !== undefined) {
            const parsedOffset = parseNonNegativeInt(rawOffset);
            if (parsedOffset === null) return res.status(400).json({ error: "Invalid offset" });
            offset = parsedOffset;
        }

        const rawBatch = Array.isArray(req.query.batch) ? req.query.batch[0] : req.query.batch;
        const batchFilter = typeof rawBatch === "string" ? rawBatch.trim() : "";

        const rawSearch = Array.isArray(req.query.search) ? req.query.search[0] : req.query.search;
        const searchFilter = typeof rawSearch === "string" ? rawSearch.trim() : "";

        const whereClauses = [];
        const values = [];

        if (batchFilter) {
            values.push(batchFilter);
            whereClauses.push(`b.batch_code = $${values.length}`);
        }

        if (statusFilter === "active") {
            whereClauses.push("a.is_active = TRUE");
        } else if (statusFilter === "inactive") {
            whereClauses.push("a.is_active = FALSE");
        }

        if (searchFilter) {
            values.push(`%${searchFilter}%`);
            const searchParam = `$${values.length}`;
            whereClauses.push(`(
                t.trainee_code ILIKE ${searchParam}
                OR t.email ILIKE ${searchParam}
                OR t.first_name ILIKE ${searchParam}
                OR COALESCE(t.middle_name, '') ILIKE ${searchParam}
                OR t.last_name ILIKE ${searchParam}
                OR concat_ws(' ', t.first_name, t.middle_name, t.last_name) ILIKE ${searchParam}
            )`);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
        const limitIndex = values.push(limit);
        const offsetIndex = values.push(offset);

        const [traineesResult, batchesResult] = await Promise.all([
            pool.query(
                `SELECT
           t.trainee_id,
           t.trainee_code,
           t.first_name,
           t.middle_name,
           t.last_name,
           t.email,
           t.contact_number,
           b.batch_id,
           b.batch_code,
           a.is_active,
           COALESCE(progress.completed_modules, 0)::INT AS completed_modules,
           COALESCE(progress.total_modules, 0)::INT AS total_modules
         FROM trainees t
         JOIN accounts a ON a.trainee_id = t.trainee_id
         JOIN batches b ON b.batch_id = t.batch_id
         LEFT JOIN (
           SELECT
             trainee_id,
             COUNT(*)::INT AS total_modules,
             COUNT(*) FILTER (WHERE module_status = 'COMPLETED')::INT AS completed_modules
           FROM v_trainee_module_status
           GROUP BY trainee_id
         ) progress ON progress.trainee_id = t.trainee_id
         ${whereSql}
         ORDER BY t.trainee_id
         LIMIT $${limitIndex}
         OFFSET $${offsetIndex}`,
                values
            ),
            pool.query(
                `SELECT batch_id, batch_code
         FROM batches
         ORDER BY batch_code`
            ),
        ]);

        const items = traineesResult.rows.map(mapAdminTraineeRowToItem);

        res.json({
            items,
            filters: {
                batches: batchesResult.rows,
            },
        });
    } catch (e) {
        console.error("Admin trainees endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/admin/trainees/:id/module-status", async (req, res) => {
    const traineeId = parsePositiveIntParam(req.params.id);
    if (!traineeId) return res.status(400).json({ error: "Invalid trainee id" });

    try {
        const traineeResult = await pool.query(
            `SELECT 1
             FROM trainees
             WHERE trainee_id = $1
             LIMIT 1`,
            [traineeId]
        );

        if (traineeResult.rowCount === 0) {
            return res.status(404).json({ error: "Trainee not found" });
        }

        const rows = await getModuleStatusRowsForTrainee(traineeId);
        return res.json(rows);
    } catch (error) {
        console.error("Admin trainee module status endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/trainees", async (req, res) => {
    const parsedPayload = parseAdminTraineePayload(req.body);
    if (parsedPayload.error) return res.status(400).json({ error: parsedPayload.error });

    const payload = parsedPayload.value;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const batch = await resolveBatchForTraineePayload(client, payload);
        if (!batch) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Batch not found" });
        }

        const emailAlreadyExists = await emailExistsForCreateTrainee(client, payload.email);
        if (emailAlreadyExists) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Email already exists" });
        }

        const nextSeq = await lockBatchAndGetNextSequence(client, batch.batch_code);
        const traineeCode = `${batch.batch_code}-${String(nextSeq).padStart(4, "0")}`;
        const generatedPassword = generateStrongPassword();
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        const traineeId = await createTraineeAndAccount(client, {
            batch_id: batch.batch_id,
            trainee_code: traineeCode,
            first_name: payload.first_name,
            middle_name: payload.middle_name,
            last_name: payload.last_name,
            email: payload.email,
            contact_number: payload.contact_number,
            address: payload.address,
            birth_date: payload.birth_date,
            password_hash: passwordHash,
        });

        const item = await fetchAdminTraineeById(client, traineeId);
        if (!item) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to load trainee after creation" });
        }

        await client.query("COMMIT");
        invalidateAdminCaches();

        let emailSent = false;
        try {
            await sendTraineeCredentialsEmail({
                to: payload.email,
                traineeName: buildTraineeFullName(payload),
                loginEmail: payload.email,
                password: generatedPassword,
                batchCode: batch.batch_code,
            });
            emailSent = true;
        } catch (mailError) {
            const mailErrorMessage =
                mailError instanceof Error && mailError.message ? mailError.message : "Failed to send credentials email.";
            logAdminCreateCredentialEmailFailure(mailErrorMessage);
        }

        if (emailSent) {
            try {
                await pool.query(
                    `UPDATE accounts
                     SET initial_password_sent_at = NOW()
                     WHERE trainee_id = $1
                       AND role = 'trainee'
                       AND is_system_protected = FALSE`,
                    [traineeId]
                );
            } catch (timestampError) {
                const timestampErrorMessage =
                    timestampError instanceof Error && timestampError.message
                        ? timestampError.message
                        : "Failed to update initial_password_sent_at.";
                console.error("Admin create trainee timestamp update failed:", timestampErrorMessage);
            }
        }

        const response = {
            item,
            email_sent: emailSent,
            password_delivery: emailSent ? "email" : SHOULD_RETURN_GENERATED_PASSWORD ? "manual" : "failed",
        };

        if (!emailSent && SHOULD_RETURN_GENERATED_PASSWORD) {
            response.generated_password = generatedPassword;
        }

        return res.status(201).json(response);
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }

        if (e?.code === "23505") {
            return res.status(409).json({ error: getConflictErrorMessage(e) });
        }

        console.error("Admin create trainee endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.put("/api/admin/trainees/:id", async (req, res) => {
    const traineeId = parsePositiveIntParam(req.params.id);
    if (!traineeId) return res.status(400).json({ error: "Invalid trainee id" });

    const parsedPayload = parseAdminTraineePayload(req.body);
    if (parsedPayload.error) return res.status(400).json({ error: parsedPayload.error });

    const payload = parsedPayload.value;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const traineeCheck = await client.query(
            `SELECT trainee_id
         FROM trainees
         WHERE trainee_id = $1
         FOR UPDATE`,
            [traineeId]
        );
        if (traineeCheck.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Trainee not found" });
        }

        const batch = await resolveBatchForTraineePayload(client, payload);
        if (!batch) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Batch not found" });
        }

        await client.query(
            `UPDATE trainees
         SET batch_id = $2,
             first_name = $3,
             middle_name = $4,
             last_name = $5,
             email = $6,
             contact_number = $7,
             address = $8,
             birth_date = $9
         WHERE trainee_id = $1`,
            [
                traineeId,
                batch.batch_id,
                payload.first_name,
                payload.middle_name,
                payload.last_name,
                payload.email,
                payload.contact_number,
                payload.address,
                payload.birth_date,
            ]
        );

        const accountUpdate = await client.query(
            `UPDATE accounts
         SET login_email = $2
         WHERE trainee_id = $1
         RETURNING trainee_id`,
            [traineeId, payload.email]
        );

        if (accountUpdate.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Account not found" });
        }

        const item = await fetchAdminTraineeById(client, traineeId);
        if (!item) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to load trainee after update" });
        }

        await client.query("COMMIT");
        invalidateAdminCaches();
        res.json({ item });
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }

        if (e?.code === "23505") {
            return res.status(409).json({ error: getConflictErrorMessage(e) });
        }

        console.error("Admin update trainee endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.patch("/api/admin/trainees/:id/status", async (req, res) => {
    const traineeId = parsePositiveIntParam(req.params.id);
    if (!traineeId) return res.status(400).json({ error: "Invalid trainee id" });

    const rawStatus = req.body?.status;
    const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";
    if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ error: "Invalid status" });
    }

    const isActive = status === "active";
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const updateResult = await client.query(
            `UPDATE accounts
         SET is_active = $2
         WHERE trainee_id = $1
         RETURNING trainee_id`,
            [traineeId, isActive]
        );

        if (updateResult.rowCount === 0) {
            const traineeExists = await client.query(
                `SELECT 1
             FROM trainees
             WHERE trainee_id = $1`,
                [traineeId]
            );

            await client.query("ROLLBACK");
            if (traineeExists.rowCount === 0) {
                return res.status(404).json({ error: "Trainee not found" });
            }
            return res.status(404).json({ error: "Account not found" });
        }

        const item = await fetchAdminTraineeById(client, traineeId);
        if (!item) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to load trainee after status update" });
        }

        await client.query("COMMIT");
        invalidateAdminCaches();
        res.json({ item });
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }

        if (e?.code === "23505") {
            return res.status(409).json({ error: getConflictErrorMessage(e) });
        }

        console.error("Admin trainee status endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.delete("/api/admin/trainees/:id", async (req, res) => {
    const traineeId = parsePositiveIntParam(req.params.id);
    if (!traineeId) return res.status(400).json({ error: "Invalid trainee id" });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const traineeResult = await client.query(
            `SELECT trainee_id
             FROM trainees
             WHERE trainee_id = $1
             FOR UPDATE`,
            [traineeId]
        );
        if (traineeResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Trainee not found" });
        }

        await client.query(
            `DELETE FROM trainee_simulation_progress
             WHERE trainee_id = $1`,
            [traineeId]
        );
        await client.query(
            `DELETE FROM accounts
             WHERE trainee_id = $1`,
            [traineeId]
        );
        const traineeDeleteResult = await client.query(
            `DELETE FROM trainees
             WHERE trainee_id = $1
             RETURNING trainee_id`,
            [traineeId]
        );

        if (traineeDeleteResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Trainee not found" });
        }

        await client.query("COMMIT");
        invalidateAdminCaches();
        return res.json({ ok: true, deleted_trainee_id: traineeId });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Admin delete trainee endpoint failed:", error);
        return res.status(500).json({ error: "Failed to delete trainee" });
    } finally {
        client.release();
    }
});

app.post("/api/admin/trainees/:id/resend-credentials", async (req, res) => {
    const traineeId = parsePositiveIntParam(req.params.id);
    if (!traineeId) {
        return res.status(400).json({ email_sent: false, error: "Invalid trainee id" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const accountResult = await client.query(
            `SELECT
               a.account_id,
               a.login_email,
               a.role,
               a.is_system_protected,
               a.initial_password_sent_at,
               t.first_name,
               t.middle_name,
               t.last_name,
               b.batch_code
             FROM accounts a
             JOIN trainees t ON t.trainee_id = a.trainee_id
             JOIN batches b ON b.batch_id = t.batch_id
             WHERE a.trainee_id = $1
             FOR UPDATE`,
            [traineeId]
        );

        if (accountResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ email_sent: false, error: "Trainee account not found" });
        }

        const account = accountResult.rows[0];
        if (account.role !== "trainee" || account.is_system_protected === true) {
            await client.query("ROLLBACK");
            return res
                .status(403)
                .json({ email_sent: false, error: "Credentials can only be resent for trainee accounts" });
        }

        const lastSentAtMs = account.initial_password_sent_at ? new Date(account.initial_password_sent_at).getTime() : null;
        if (lastSentAtMs && Number.isFinite(lastSentAtMs)) {
            const elapsedMs = Date.now() - lastSentAtMs;
            if (elapsedMs < RESEND_CREDENTIALS_COOLDOWN_MS) {
                const retryAfterSeconds = Math.max(1, Math.ceil((RESEND_CREDENTIALS_COOLDOWN_MS - elapsedMs) / 1000));
                await client.query("ROLLBACK");
                return res.status(429).json({
                    email_sent: false,
                    error: "Credentials were sent recently. Please retry later.",
                    retry_after_seconds: retryAfterSeconds,
                });
            }
        }

        const generatedPassword = generateStrongPassword();
        const passwordHash = await bcrypt.hash(generatedPassword, 10);

        await client.query(
            `UPDATE accounts
             SET password_hash = $2
             WHERE account_id = $1`,
            [account.account_id, passwordHash]
        );

        try {
            await sendTraineeCredentialsEmail({
                to: account.login_email,
                traineeName: buildTraineeFullName(account),
                loginEmail: account.login_email,
                password: generatedPassword,
                batchCode: account.batch_code,
            });
        } catch (mailError) {
            await client.query("ROLLBACK");
            const mailErrorMessage =
                mailError instanceof Error && mailError.message ? mailError.message : "Failed to send credentials email.";
            console.error("Admin resend credentials email failed:", mailErrorMessage);
            return res.status(502).json({ email_sent: false, error: "Failed to send credentials email." });
        }

        await client.query(
            `UPDATE accounts
             SET initial_password_sent_at = NOW()
             WHERE account_id = $1`,
            [account.account_id]
        );

        await client.query("COMMIT");
        return res.json({ email_sent: true });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Admin resend credentials endpoint failed:", error);
        return res.status(500).json({ email_sent: false, error: "Internal server error" });
    } finally {
        client.release();
    }
});

app.post("/api/admin/trainees/:id/reset-pin", async (req, res) => {
    res.status(501).json({ error: "PIN reset is not enabled in this deployment." });
});

app.get("/api/resources/:resourceId/pdf", requireAuth, async (req, res) => {
    const resourceId = parsePositiveIntParam(req.params.resourceId);
    if (!resourceId) return res.status(400).json({ error: "Invalid resource id" });

    try {
        const result = await pool.query(
            `SELECT
               mr.resource_id::INT AS resource_id,
               mr.type,
               mrf.storage_key,
               mrf.original_filename,
               mrf.mime_type,
               mrf.file_size
             FROM module_resources mr
             JOIN modules m ON m.module_id = mr.module_id
             JOIN module_resource_files mrf ON mrf.resource_id = mr.resource_id
             WHERE mr.resource_id = $1
               AND mr.type = 'PDF'
               AND m.is_active = TRUE
             LIMIT 1`,
            [resourceId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "PDF resource not found" });
        }

        const row = result.rows[0];
        const storagePath = resolveLessonPdfStoragePath(row.storage_key);
        let stats;
        try {
            stats = await fsPromises.stat(storagePath);
        } catch (error) {
            if (error?.code === "ENOENT") return res.status(404).json({ error: "PDF file not found" });
            throw error;
        }

        if (!stats.isFile()) {
            return res.status(404).json({ error: "PDF file not found" });
        }

        const downloadName = sanitizePdfOriginalFilename(row.original_filename || `module-${resourceId}.pdf`);
        const contentLength = Number(row.file_size) > 0 ? Number(row.file_size) : stats.size;

        res.setHeader("Content-Type", row.mime_type || "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=\"${downloadName}\"`);
        res.setHeader("Content-Length", String(contentLength));
        res.setHeader("X-Content-Type-Options", "nosniff");

        const stream = fs.createReadStream(storagePath);
        stream.on("error", (streamError) => {
            console.error("PDF stream failed:", streamError);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to stream PDF" });
                return;
            }
            res.destroy(streamError);
        });

        return stream.pipe(res);
    } catch (error) {
        console.error("PDF read endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// Modules + resources + simulations
app.get("/api/modules", requireAuth, async (req, res) => {
    try {
        const modules = await pool.query("SELECT * FROM modules ORDER BY order_no;");
        const resources = await pool.query(getModuleResourcesWithFilesSql());
        const sims = await pool.query("SELECT * FROM simulations ORDER BY module_id, order_no;");
        res.json({ modules: modules.rows, resources: resources.rows, simulations: sims.rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Computed module status for a trainee (Option A view)
app.get("/api/trainees/:traineeId/module-status", requireAuth, async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });
        if (!ensureTraineeOwnership(req, res, traineeId)) return;

        const rows = await getModuleStatusRowsForTrainee(traineeId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/me/module-status", requireAuth, async (req, res) => {
    try {
        const traineeId = ensureTraineeOwnership(req, res);
        if (!traineeId) return;

        const rows = await getModuleStatusRowsForTrainee(traineeId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/trainees", requireAuth, requireAdmin, async (req, res) => {
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

app.get("/api/trainees/:traineeId/dashboard", requireAuth, async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });
        if (!ensureTraineeOwnership(req, res, traineeId)) return;

        const payload = await getDashboardPayloadForTrainee(traineeId);
        if (!payload) return res.status(404).json({ error: "Trainee not found" });

        res.json(payload);
    } catch (e) {
        console.error("Dashboard endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/me/dashboard", requireAuth, async (req, res) => {
    try {
        const traineeId = ensureTraineeOwnership(req, res);
        if (!traineeId) return;

        const payload = await getDashboardPayloadForTrainee(traineeId);
        if (!payload) return res.status(404).json({ error: "Trainee not found" });

        res.json(payload);
    } catch (e) {
        console.error("Dashboard endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/trainees/:traineeId/simulations/:simulationId/complete", requireAuth, async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });
        if (!ensureTraineeOwnership(req, res, traineeId)) return;

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

        const completionResult = await completeSimulationForTrainee(traineeId, simulationId, bestScore);
        if (completionResult.error) return res.status(completionResult.status).json({ error: completionResult.error });

        res.json({ ok: true });
    } catch (e) {
        console.error("Simulation completion endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/me/simulations/:simulationId/complete", requireAuth, async (req, res) => {
    try {
        const traineeId = ensureTraineeOwnership(req, res);
        if (!traineeId) return;

        const simulationId = parsePositiveIntParam(req.params.simulationId);
        if (!simulationId) return res.status(400).json({ error: "Invalid simulationId" });

        const rawBestScore = req.body?.bestScore;
        let bestScore = null;

        if (rawBestScore !== undefined && rawBestScore !== null) {
            const isValidScore = typeof rawBestScore === "number" && Number.isFinite(rawBestScore) && rawBestScore >= 0;
            if (!isValidScore) return res.status(400).json({ error: "Invalid bestScore" });
            bestScore = rawBestScore;
        }

        const completionResult = await completeSimulationForTrainee(traineeId, simulationId, bestScore);
        if (completionResult.error) return res.status(completionResult.status).json({ error: completionResult.error });

        res.json({ ok: true });
    } catch (e) {
        console.error("Simulation completion endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API running on port ${PORT}`));
// const PORT = Number(process.env.PORT || 4000);
// app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));
