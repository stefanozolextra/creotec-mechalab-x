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
const { createClient } = require("@supabase/supabase-js");

// --- Supabase Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const BUCKET_NAME = "mechalab-pdfs";
// ----------------------

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
    process.env.RETURN_GENERATED_PASSWORD?.trim().toLowerCase() === "true";
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
const QUIZ_TITLE_MAX_LENGTH = 150;
const QUIZ_QUESTION_TEXT_MAX_LENGTH = 1500;
const QUIZ_CHOICE_TEXT_MAX_LENGTH = 500;
const QUIZ_PASSING_SCORE_PERCENT = 75;
const QUIZ_MAX_CHOICES_PER_QUESTION = 4;
const QUIZ_STATUS_DRAFT = "draft";
const QUIZ_STATUS_PUBLISHED = "published";
const QUIZ_STATUS_ARCHIVED = "archived";
const QUIZ_ATTEMPT_STATUS_IN_PROGRESS = "in_progress";
const QUIZ_ATTEMPT_STATUS_SUBMITTED = "submitted";
const QUIZ_ATTEMPT_STATUS_EXPIRED = "expired";
const LESSON_PDF_MAX_FILE_SIZE_BYTES = parsePositiveIntEnv("LESSON_PDF_MAX_FILE_SIZE_BYTES", 10 * 1024 * 1024);
const LESSON_UPLOADS_DIR = path.resolve(
    __dirname,
    process.env.LESSON_UPLOADS_DIR?.trim() || path.join("uploads", "module-pdfs")
);
const LESSON_RESOURCE_TYPE_PDF = "PDF";
const LESSON_RESOURCE_TYPE_VIDEO = "VIDEO";
const DIRECT_VIDEO_ALLOWED_EXTENSIONS = new Set([".mp4", ".webm"]);
const PDF_ALLOWED_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);
const ACCOUNT_ACCESS_MODE_STANDARD = "standard";
const ACCOUNT_ACCESS_MODE_LESSON_ONLY = "lesson_only";
const ACCOUNT_ACCESS_MODES = new Set([ACCOUNT_ACCESS_MODE_STANDARD, ACCOUNT_ACCESS_MODE_LESSON_ONLY]);

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

function isLessonOnlyAccessMode(accessMode) {
    return normalizeAccountAccessMode(accessMode) === ACCOUNT_ACCESS_MODE_LESSON_ONLY;
}

function canAccessSimulationFeatures(accessMode) {
    return !isLessonOnlyAccessMode(accessMode);
}

async function getLiveAuthAccountOrRespond(req, res) {
    const accountId = Number(req.auth?.account_id);
    if (!Number.isInteger(accountId) || accountId < 1) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
    }

    try {
        const result = await pool.query(
            `SELECT account_id, trainee_id, role, is_active, is_system_protected, access_mode
             FROM accounts
             WHERE account_id = $1
             LIMIT 1`,
            [accountId]
        );

        if (result.rowCount === 0) {
            res.status(401).json({ error: "Unauthorized" });
            return null;
        }

        const account = result.rows[0];
        if (!account.is_active) {
            res.status(403).json({ error: "Account is inactive" });
            return null;
        }

        const liveRole = roleFromAccountRow(account);
        const liveTraineeId = account.trainee_id == null ? null : Number(account.trainee_id);
        const accessMode = normalizeAccountAccessMode(account.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD;

        req.auth = {
            ...req.auth,
            role: liveRole,
            trainee_id: liveTraineeId,
            access_mode: accessMode,
        };

        return {
            account_id: Number(account.account_id),
            trainee_id: liveTraineeId,
            role: liveRole,
            access_mode: accessMode,
        };
    } catch (error) {
        console.error("Live auth account lookup failed:", error);
        res.status(500).json({ error: "Internal server error" });
        return null;
    }
}

async function requireLiveTraineeAccess(req, res, requestedTraineeId = null) {
    const account = await getLiveAuthAccountOrRespond(req, res);
    if (!account) return null;

    if (account.role !== "trainee") {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    if (!Number.isInteger(account.trainee_id) || Number(account.trainee_id) < 1) {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    if (requestedTraineeId !== null && requestedTraineeId !== account.trainee_id) {
        res.status(403).json({ error: "Forbidden" });
        return null;
    }

    return account;
}

function respondLessonOnlySimulationDenied(res) {
    return res.status(403).json({
        error: "Simulation access is disabled for lesson-only trainees.",
    });
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

function normalizeAccountAccessMode(value, fallback = ACCOUNT_ACCESS_MODE_STANDARD) {
    if (value == null) return fallback;
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (!ACCOUNT_ACCESS_MODES.has(normalized)) return null;
    return normalized;
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

async function logAdminAction(clientOrPool, accountId, type, batchCode, message, meta = {}) {
    await clientOrPool.query(
        `INSERT INTO admin_action_logs (actor_account_id, type, batch_code, message, meta)
         VALUES ($1, $2, $3, $4, $5)`,
        [accountId || null, type, batchCode || null, message, JSON.stringify(meta)]
    ).catch(e => console.error("Failed to log admin action:", e));
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
        row.type && String(row.type).startsWith("admin_")
            ? row.type
            : row.type === "system_reset"
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

           UNION ALL

           SELECT
             CONCAT('admin_action:', al.action_id)::TEXT AS event_id,
             al.type::TEXT AS type,
             al.occurred_at AS occurred_at,
             al.batch_code AS batch_code,
             actor.login_email AS actor,
             al.message AS message,
             al.meta AS meta
           FROM admin_action_logs al
           LEFT JOIN accounts actor ON actor.account_id = al.actor_account_id
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
    const accessMode = normalizeAccountAccessMode(row.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD;
    const totalModules = Number(row.total_modules) || 0;
    const completedModules = Number(row.completed_modules) || 0;
    const percent = totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100);
    const label =
        accessMode === ACCOUNT_ACCESS_MODE_LESSON_ONLY
            ? "Lesson Only"
            : totalModules === 0
              ? "0/0 Modules"
              : percent === 100
                ? "Done"
                : `${completedModules}/${totalModules} Modules`;

    return {
        trainee_id: row.trainee_id,
        trainee_code: row.trainee_code,
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        email: row.email,
        contact_number: row.contact_number,
        access_mode: accessMode,
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

function getAdminModuleReportingStatus(accessMode, moduleStatus) {
    return isLessonOnlyAccessMode(accessMode) ? "LESSON_ONLY" : String(moduleStatus || "NOT_STARTED");
}

const ADMIN_MODULE_STATUS_QUIZ_CTES = `
    WITH module_quiz_requirements AS (
      SELECT
        q.module_id,
        COUNT(*) FILTER (WHERE q.status = '${QUIZ_STATUS_PUBLISHED}') > 0 AS quiz_required
      FROM quizzes q
      GROUP BY q.module_id
    ),
    trainee_module_quiz_progress AS (
      SELECT
        qa.trainee_id,
        q.module_id,
        BOOL_OR(
          qa.passed = TRUE
          AND qa.status IN ('${QUIZ_ATTEMPT_STATUS_SUBMITTED}', '${QUIZ_ATTEMPT_STATUS_EXPIRED}')
          AND q.status IN ('${QUIZ_STATUS_PUBLISHED}', '${QUIZ_STATUS_ARCHIVED}')
        ) AS quiz_passed
      FROM quiz_attempts qa
      JOIN quizzes q ON q.quiz_id = qa.quiz_id
      GROUP BY qa.trainee_id, q.module_id
    )`;

function mapAdminModuleStatusRow(row) {
    const accessMode = normalizeAccountAccessMode(row.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD;
    return {
        ...row,
        access_mode: accessMode,
        quiz_required: row.quiz_required === true,
        quiz_passed: row.quiz_passed === true,
        reporting_status: getAdminModuleReportingStatus(accessMode, row.module_status),
    };
}

async function getAdminModuleStatusRowsForTrainee(traineeId) {
    const result = await pool.query(
        `${ADMIN_MODULE_STATUS_QUIZ_CTES}
         SELECT
           v.module_id,
           v.module_code,
           v.module_title,
           v.required_sims,
           v.completed_required_sims,
           v.module_status,
           COALESCE(module_quiz.quiz_required, FALSE) AS quiz_required,
           COALESCE(quiz_progress.quiz_passed, FALSE) AS quiz_passed,
           a.access_mode
         FROM v_trainee_module_status v
         JOIN accounts a ON a.trainee_id = v.trainee_id
         LEFT JOIN module_quiz_requirements module_quiz ON module_quiz.module_id = v.module_id
         LEFT JOIN trainee_module_quiz_progress quiz_progress
           ON quiz_progress.trainee_id = v.trainee_id
          AND quiz_progress.module_id = v.module_id
         WHERE v.trainee_id = $1
         ORDER BY v.module_id`,
        [traineeId]
    );

    return result.rows.map(mapAdminModuleStatusRow);
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
           a.access_mode,
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

    const accessMode = normalizeAccountAccessMode(body.access_mode);
    if (accessMode === null) return { error: "Invalid access_mode" };

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
            access_mode: accessMode,
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
const CSV_ACCESS_MODE_HEADERS = new Set(["access mode", "accessmode"]);

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
    let hasAccessModeColumn = false;

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
                if (CSV_ACCESS_MODE_HEADERS.has(normalizedHeader)) {
                    hasAccessModeColumn = true;
                    return "access_mode";
                }
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
        const access_mode = sanitizeOptionalString(record.access_mode);

        if (!first_name && !middle_name && !last_name && !email && !contact_number && !access_mode) continue;

        rows.push({
            row: index + 2,
            first_name,
            middle_name,
            last_name,
            email: email ? normalizeEmail(email) : null,
            contact_number,
            access_mode,
        });
    }

    return {
        rows,
        has_access_mode_column: hasAccessModeColumn,
    };
}

function parseCsvImportAccessMode(rawAccessMode, hasAccessModeColumn) {
    if (!hasAccessModeColumn) {
        return {
            access_mode: ACCOUNT_ACCESS_MODE_STANDARD,
            should_update_existing: false,
        };
    }

    const accessMode = normalizeAccountAccessMode(rawAccessMode);
    if (accessMode === null) {
        return {
            error: `Invalid access_mode "${rawAccessMode}". Expected standard or lesson_only`,
        };
    }

    return {
        access_mode: accessMode || ACCOUNT_ACCESS_MODE_STANDARD,
        should_update_existing: true,
    };
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
    const accessMode = normalizeAccountAccessMode(payload.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD;

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
          (trainee_id, login_email, password_hash, is_active, role, is_system_protected, access_mode)
         VALUES
          ($1, $2, $3, TRUE, 'trainee', FALSE, $4)`,
        [traineeInsert.rows[0].trainee_id, payload.email, payload.password_hash, accessMode]
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

// --- Supabase Storage Helpers ---
async function storeLessonPdf(storageKey, buffer, mimeType) {
    if (supabase) {
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(storageKey, buffer, {
            contentType: mimeType,
            upsert: true
        });
        if (error) throw new Error("Supabase upload failed: " + error.message);
    } else {
        const filePath = resolveLessonPdfStoragePath(storageKey);
        await ensureLessonUploadsDirectory();
        await fsPromises.writeFile(filePath, buffer);
    }
}

async function removeStoredLessonPdf(storageKey) {
    if (supabase) {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([storageKey]);
        if (error) console.error("Supabase delete failed:", error.message);
    } else {
        try {
            const filePath = resolveLessonPdfStoragePath(storageKey);
            await fsPromises.unlink(filePath);
        } catch (error) {
            if (error?.code === "ENOENT") return;
            console.error("Failed to remove stored lesson PDF:", error);
        }
    }
}
// -------------------------------

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

async function getCurriculumContent({ includeSimulations = true } = {}) {
    const [modulesResult, resources, simulationsResult] = await Promise.all([
        pool.query("SELECT * FROM modules ORDER BY order_no"),
        getModuleResourcesRowsSafe(),
        includeSimulations
            ? pool.query("SELECT * FROM simulations ORDER BY module_id, order_no")
            : Promise.resolve({ rows: [] }),
    ]);

    return {
        modules: modulesResult.rows,
        resources,
        simulations: simulationsResult.rows,
    };
}

function shouldIncludeDeveloperCurriculumSimulations(req) {
    if (process.env.NODE_ENV === "production") return false;

    const rawIncludeSimulations = Array.isArray(req.query?.include_simulations)
        ? req.query.include_simulations[0]
        : req.query?.include_simulations;

    return typeof rawIncludeSimulations === "string" && rawIncludeSimulations.trim().toLowerCase() === "developer";
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
    const [moduleResult, lessonRows, simRows] = await Promise.all([
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
        pool.query(
            `SELECT simulation_id::INT AS simulation_id, simulation_code, title, module_id::INT AS module_id
             FROM simulations
             WHERE ($1::BIGINT IS NULL OR module_id = $1)
             ORDER BY order_no, simulation_id`,
            [moduleId]
        )
    ]);

    const lessonsByModuleId = new Map();
    for (const lesson of lessonRows) {
        const key = Number(lesson.module_id);
        if (!lessonsByModuleId.has(key)) lessonsByModuleId.set(key, []);
        lessonsByModuleId.get(key).push(lesson);
    }

    const simsByModuleId = new Map();
    for (const sim of simRows.rows) {
        const key = Number(sim.module_id);
        if (!simsByModuleId.has(key)) simsByModuleId.set(key, []);
        simsByModuleId.get(key).push(sim);
    }

    return moduleResult.rows.map((row) => {
        const safeModuleId = Number(row.module_id) || 0;
        return {
            module_id: safeModuleId,
            module_code: row.module_code || "",
            module_title: row.module_title || "",
            description: row.description || null,
            order_no: Number(row.order_no) || 0,
            is_active: row.is_active === true,
            lessons: lessonsByModuleId.get(safeModuleId) || [],
            simulations: simsByModuleId.get(safeModuleId) || [],
        };
    });
}

function createHttpError(statusCode, message, details = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (details !== null) {
        error.details = details;
    }
    return error;
}

function isMissingQuizSchemaError(error) {
    return (
        isUndefinedTableError(error, "quizzes") ||
        isUndefinedTableError(error, "quiz_questions") ||
        isUndefinedTableError(error, "quiz_choices") ||
        isUndefinedTableError(error, "quiz_attempts") ||
        isUndefinedTableError(error, "quiz_attempt_answers")
    );
}

function getQuizSchemaApplyMessage() {
    return 'Quiz schema is not installed. Run: psql "$DATABASE_URL" -f "mechalabx-db/db/06_quizzes.sql"';
}

function normalizeQuizTextField(value, maxLength) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > maxLength) return null;
    return trimmed;
}

function normalizeQuizTitle(value) {
    return normalizeQuizTextField(value, QUIZ_TITLE_MAX_LENGTH);
}

function normalizeQuizQuestionText(value) {
    return normalizeQuizTextField(value, QUIZ_QUESTION_TEXT_MAX_LENGTH);
}

function normalizeQuizChoiceText(value) {
    return normalizeQuizTextField(value, QUIZ_CHOICE_TEXT_MAX_LENGTH);
}

function normalizeQuizPositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return parsed;
}

function buildDraftCloneQuizTitle(title) {
    const baseTitle = normalizeQuizTitle(title) || "Quiz";
    const suffix = " (Draft Copy)";
    if (baseTitle.length + suffix.length <= QUIZ_TITLE_MAX_LENGTH) {
        return `${baseTitle}${suffix}`;
    }

    const sliceLength = Math.max(1, QUIZ_TITLE_MAX_LENGTH - suffix.length);
    return `${baseTitle.slice(0, sliceLength).trim()}${suffix}`;
}

function toIsoTimestamp(value) {
    return value ? new Date(value).toISOString() : null;
}

function getQuizChoiceLabel(choiceNo) {
    const safeChoiceNo = Number(choiceNo);
    if (!Number.isInteger(safeChoiceNo) || safeChoiceNo < 1) return "";
    return String.fromCharCode(64 + safeChoiceNo);
}

function mapQuizAttemptRow(row) {
    const status =
        row?.status === QUIZ_ATTEMPT_STATUS_SUBMITTED || row?.status === QUIZ_ATTEMPT_STATUS_EXPIRED
            ? row.status
            : QUIZ_ATTEMPT_STATUS_IN_PROGRESS;

    return {
        attempt_id: Number(row?.attempt_id) || 0,
        quiz_id: Number(row?.quiz_id) || 0,
        trainee_id: Number(row?.trainee_id) || 0,
        attempt_no: Number(row?.attempt_no) || 0,
        status,
        score_percent: row?.score_percent == null ? null : Number(row.score_percent),
        passed: row?.passed == null ? null : row.passed === true,
        time_limit_seconds: Number(row?.time_limit_seconds) || 0,
        quiz_status:
            row?.quiz_status === QUIZ_STATUS_PUBLISHED || row?.quiz_status === QUIZ_STATUS_ARCHIVED
                ? row.quiz_status
                : QUIZ_STATUS_DRAFT,
        passing_score_percent: Number(row?.passing_score_percent) || QUIZ_PASSING_SCORE_PERCENT,
        max_attempts: Number(row?.max_attempts) || 0,
        time_limit_minutes: Number(row?.time_limit_minutes) || 0,
        started_at: toIsoTimestamp(row?.started_at),
        submitted_at: toIsoTimestamp(row?.submitted_at),
        created_at: toIsoTimestamp(row?.created_at),
        updated_at: toIsoTimestamp(row?.updated_at),
    };
}

function mapQuizAttemptAnswerRow(row) {
    return {
        attempt_id: Number(row?.attempt_id) || 0,
        question_id: Number(row?.question_id) || 0,
        question_order_no: Number(row?.question_order_no) || 0,
        selected_choice_id: Number(row?.selected_choice_id) || 0,
        created_at: toIsoTimestamp(row?.created_at),
        updated_at: toIsoTimestamp(row?.updated_at),
    };
}

function mapAdminQuizModuleRow(row) {
    return {
        module_id: Number(row.module_id) || 0,
        module_code: row.module_code || "",
        module_title: row.module_title || "",
        order_no: Number(row.order_no) || 0,
        is_active: row.is_active === true,
    };
}

function mapAdminQuizSummaryRow(row) {
    const status =
        row.status === QUIZ_STATUS_PUBLISHED || row.status === QUIZ_STATUS_ARCHIVED
            ? row.status
            : QUIZ_STATUS_DRAFT;
    const attemptCount = Number(row.attempt_count) || 0;

    return {
        quiz_id: Number(row.quiz_id) || 0,
        module_id: Number(row.module_id) || 0,
        module_code: row.module_code || "",
        module_title: row.module_title || "",
        module_order_no: Number(row.module_order_no) || 0,
        module_is_active: row.module_is_active === true,
        cloned_from_quiz_id:
            row.cloned_from_quiz_id == null ? null : Number(row.cloned_from_quiz_id) || null,
        title: row.title || "",
        status,
        passing_score_percent: Number(row.passing_score_percent) || QUIZ_PASSING_SCORE_PERCENT,
        max_attempts: Number(row.max_attempts) || 0,
        time_limit_minutes: Number(row.time_limit_minutes) || 0,
        question_count: Number(row.question_count) || 0,
        attempt_count: attemptCount,
        created_at: toIsoTimestamp(row.created_at),
        updated_at: toIsoTimestamp(row.updated_at),
        published_at: toIsoTimestamp(row.published_at),
        archived_at: toIsoTimestamp(row.archived_at),
        has_attempts: attemptCount > 0,
        can_edit: status === QUIZ_STATUS_DRAFT,
        can_publish: status === QUIZ_STATUS_DRAFT,
        can_archive: status === QUIZ_STATUS_PUBLISHED,
        can_clone: true,
        can_delete: status === QUIZ_STATUS_DRAFT && attemptCount === 0,
    };
}

async function getAdminQuizModuleOptions(queryable = pool) {
    const result = await queryable.query(
        `SELECT
           module_id::INT AS module_id,
           module_code,
           title AS module_title,
           order_no::INT AS order_no,
           is_active
         FROM modules
         ORDER BY COALESCE(order_no, 2147483647), module_id`
    );

    return result.rows.map(mapAdminQuizModuleRow);
}

async function getAdminQuizSummaryItems(quizId = null, queryable = pool) {
    const result = await queryable.query(
        `SELECT
           q.quiz_id::INT AS quiz_id,
           q.module_id::INT AS module_id,
           m.module_code,
           m.title AS module_title,
           m.order_no::INT AS module_order_no,
           m.is_active AS module_is_active,
           q.cloned_from_quiz_id::INT AS cloned_from_quiz_id,
           q.title,
           q.status,
           q.passing_score_percent::INT AS passing_score_percent,
           q.max_attempts::INT AS max_attempts,
           q.time_limit_minutes::INT AS time_limit_minutes,
           q.created_at,
           q.updated_at,
           q.published_at,
           q.archived_at,
           COALESCE(question_counts.question_count, 0)::INT AS question_count,
           COALESCE(attempt_counts.attempt_count, 0)::INT AS attempt_count
         FROM quizzes q
         JOIN modules m ON m.module_id = q.module_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::INT AS question_count
           FROM quiz_questions qq
           WHERE qq.quiz_id = q.quiz_id
         ) question_counts ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::INT AS attempt_count
           FROM quiz_attempts qa
           WHERE qa.quiz_id = q.quiz_id
         ) attempt_counts ON TRUE
         WHERE ($1::BIGINT IS NULL OR q.quiz_id = $1)
         ORDER BY
           COALESCE(m.order_no, 2147483647),
           m.module_id,
           CASE q.status
             WHEN 'published' THEN 1
             WHEN 'draft' THEN 2
             ELSE 3
           END,
           COALESCE(q.published_at, q.created_at) DESC,
           q.quiz_id DESC`,
        [quizId]
    );

    return result.rows.map(mapAdminQuizSummaryRow);
}

function buildQuizPublishChecks(quiz) {
    const errors = [];

    if (!Number.isInteger(Number(quiz?.module_id)) || Number(quiz.module_id) < 1) {
        errors.push("Quiz must be linked to a valid module.");
    }
    if (!normalizeQuizTitle(quiz?.title)) {
        errors.push(`Quiz title is required and must be at most ${QUIZ_TITLE_MAX_LENGTH} characters.`);
    }
    if (!normalizeQuizPositiveInt(quiz?.time_limit_minutes)) {
        errors.push("Timer is required and must be a positive number of minutes.");
    }
    if (!normalizeQuizPositiveInt(quiz?.max_attempts)) {
        errors.push("Max attempts must be a positive integer.");
    }

    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    if (questions.length === 0) {
        errors.push("Quiz must contain at least 1 question before publishing.");
    }

    let questionOrderErrorAdded = false;
    for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
        const question = questions[questionIndex];
        const displayNumber = questionIndex + 1;

        if (!normalizeQuizQuestionText(question?.question_text)) {
            errors.push(`Question ${displayNumber} must have text.`);
        }
        if (Number(question?.order_no) !== displayNumber && !questionOrderErrorAdded) {
            errors.push("Questions must use a continuous order starting at 1.");
            questionOrderErrorAdded = true;
        }

        const choices = Array.isArray(question?.choices) ? question.choices : [];
        if (choices.length !== QUIZ_MAX_CHOICES_PER_QUESTION) {
            errors.push(`Question ${displayNumber} must have exactly ${QUIZ_MAX_CHOICES_PER_QUESTION} choices.`);
        }

        let correctChoiceCount = 0;
        let choiceOrderErrorAdded = false;
        for (let choiceIndex = 0; choiceIndex < choices.length; choiceIndex += 1) {
            const choice = choices[choiceIndex];

            if (!normalizeQuizChoiceText(choice?.choice_text)) {
                errors.push(`Question ${displayNumber}, choice ${choiceIndex + 1} must have text.`);
            }
            if (Number(choice?.choice_no) !== choiceIndex + 1 && !choiceOrderErrorAdded) {
                errors.push(`Question ${displayNumber} choices must stay in order.`);
                choiceOrderErrorAdded = true;
            }
            if (choice?.is_correct === true) {
                correctChoiceCount += 1;
            }
        }

        if (correctChoiceCount !== 1) {
            errors.push(`Question ${displayNumber} must have exactly 1 correct choice.`);
        }
    }

    return {
        ready: errors.length === 0,
        errors: [...new Set(errors)],
    };
}

function buildAdminQuizDetailFromRows(summary, rows) {
    if (!summary) return null;

    const questionsById = new Map();
    const questions = [];

    for (const row of rows) {
        const questionId = Number(row.question_id);
        if (!Number.isInteger(questionId) || questionId < 1) {
            continue;
        }

        let question = questionsById.get(questionId);
        if (!question) {
            question = {
                question_id: questionId,
                quiz_id: summary.quiz_id,
                question_text: row.question_text || "",
                order_no: Number(row.order_no) || 0,
                choices: [],
                choice_count: 0,
                correct_choice_count: 0,
            };
            questionsById.set(questionId, question);
            questions.push(question);
        }

        const choiceId = row.choice_id == null ? null : Number(row.choice_id);
        if (!Number.isInteger(choiceId) || choiceId < 1) {
            continue;
        }

        const choice = {
            choice_id: choiceId,
            question_id: questionId,
            choice_no: Number(row.choice_no) || 0,
            label: getQuizChoiceLabel(row.choice_no),
            choice_text: row.choice_text || "",
            is_correct: row.is_correct === true,
        };
        question.choices.push(choice);
        question.choice_count = question.choices.length;
        if (choice.is_correct) {
            question.correct_choice_count += 1;
        }
    }

    questions.sort((a, b) => a.order_no - b.order_no || a.question_id - b.question_id);
    for (const question of questions) {
        question.choices.sort((a, b) => a.choice_no - b.choice_no || a.choice_id - b.choice_id);
        question.choice_count = question.choices.length;
        question.correct_choice_count = question.choices.filter((choice) => choice.is_correct).length;
    }

    const quiz = {
        ...summary,
        questions,
        stats: {
            question_count: questions.length,
            attempt_count: summary.attempt_count,
        },
    };

    quiz.publish_checks = buildQuizPublishChecks(quiz);
    return quiz;
}

async function getAdminQuizDetail(quizId, queryable = pool) {
    const safeQuizId = parsePositiveIntParam(quizId);
    if (!safeQuizId) return null;

    const [summary] = await getAdminQuizSummaryItems(safeQuizId, queryable);
    if (!summary) return null;

    const result = await queryable.query(
        `SELECT
           qq.question_id::INT AS question_id,
           qq.question_text,
           qq.order_no::INT AS order_no,
           qc.choice_id::INT AS choice_id,
           qc.choice_no::INT AS choice_no,
           qc.choice_text,
           qc.is_correct
         FROM quiz_questions qq
         LEFT JOIN quiz_choices qc ON qc.question_id = qq.question_id
         WHERE qq.quiz_id = $1
         ORDER BY qq.order_no, qq.question_id, qc.choice_no, qc.choice_id`,
        [safeQuizId]
    );

    return buildAdminQuizDetailFromRows(summary, result.rows);
}

function mapTraineeQuizSummaryRow(row) {
    return {
        quiz_id: Number(row?.quiz_id) || 0,
        module_id: Number(row?.module_id) || 0,
        module_code: row?.module_code || "",
        module_title: row?.module_title || "",
        title: row?.title || "",
        status: row?.status === QUIZ_STATUS_PUBLISHED ? QUIZ_STATUS_PUBLISHED : QUIZ_STATUS_DRAFT,
        passing_score_percent: Number(row?.passing_score_percent) || QUIZ_PASSING_SCORE_PERCENT,
        max_attempts: Number(row?.max_attempts) || 0,
        time_limit_minutes: Number(row?.time_limit_minutes) || 0,
        question_count: Number(row?.question_count) || 0,
        created_at: toIsoTimestamp(row?.created_at),
        updated_at: toIsoTimestamp(row?.updated_at),
        published_at: toIsoTimestamp(row?.published_at),
    };
}

async function getPublishedTraineeQuizSummaryForModule(moduleId, queryable = pool, { lock = false } = {}) {
    let query = `SELECT
           q.quiz_id::INT AS quiz_id,
           q.module_id::INT AS module_id,
           m.module_code,
           m.title AS module_title,
           q.title,
           q.status,
           q.passing_score_percent::INT AS passing_score_percent,
           q.max_attempts::INT AS max_attempts,
           q.time_limit_minutes::INT AS time_limit_minutes,
           q.created_at,
           q.updated_at,
           q.published_at,
           COALESCE(question_counts.question_count, 0)::INT AS question_count
         FROM quizzes q
         JOIN modules m ON m.module_id = q.module_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::INT AS question_count
           FROM quiz_questions qq
           WHERE qq.quiz_id = q.quiz_id
         ) question_counts ON TRUE
         WHERE q.module_id = $1
           AND q.status = $2
         ORDER BY COALESCE(q.published_at, q.created_at) DESC, q.quiz_id DESC
         LIMIT 1`;

    if (lock) {
        query += ` FOR UPDATE OF q`;
    }

    const result = await queryable.query(query, [moduleId, QUIZ_STATUS_PUBLISHED]);
    if (result.rowCount === 0) {
        return null;
    }

    return mapTraineeQuizSummaryRow(result.rows[0]);
}

function buildTraineeQuizQuestionsFromRows(rows) {
    const questionsById = new Map();
    const questions = [];

    for (const row of rows) {
        const questionId = Number(row?.question_id);
        if (!Number.isInteger(questionId) || questionId < 1) {
            continue;
        }

        let question = questionsById.get(questionId);
        if (!question) {
            question = {
                question_id: questionId,
                order_no: Number(row?.order_no) || 0,
                question_text: row?.question_text || "",
                choices: [],
            };
            questionsById.set(questionId, question);
            questions.push(question);
        }

        const choiceId = Number(row?.choice_id);
        if (!Number.isInteger(choiceId) || choiceId < 1) {
            continue;
        }

        question.choices.push({
            choice_id: choiceId,
            choice_no: Number(row?.choice_no) || 0,
            label: getQuizChoiceLabel(row?.choice_no),
            choice_text: row?.choice_text || "",
        });
    }

    questions.sort((a, b) => a.order_no - b.order_no || a.question_id - b.question_id);
    for (const question of questions) {
        question.choices.sort((a, b) => a.choice_no - b.choice_no || a.choice_id - b.choice_id);
    }

    return questions;
}

async function getTraineeQuizQuestions(quizId, queryable = pool) {
    const result = await queryable.query(
        `SELECT
           qq.question_id::INT AS question_id,
           qq.order_no::INT AS order_no,
           qq.question_text,
           qc.choice_id::INT AS choice_id,
           qc.choice_no::INT AS choice_no,
           qc.choice_text
         FROM quiz_questions qq
         JOIN quiz_choices qc ON qc.question_id = qq.question_id
         WHERE qq.quiz_id = $1
         ORDER BY qq.order_no, qq.question_id, qc.choice_no, qc.choice_id`,
        [quizId]
    );

    return buildTraineeQuizQuestionsFromRows(result.rows);
}

async function getQuizAttemptCountByQuizAndTrainee(client, quizId, traineeId) {
    const result = await client.query(
        `SELECT COUNT(*)::INT AS attempt_count
         FROM quiz_attempts
         WHERE quiz_id = $1
           AND trainee_id = $2`,
        [quizId, traineeId]
    );

    return Number(result.rows[0]?.attempt_count) || 0;
}

async function getLatestFinalQuizAttemptByQuizAndTrainee(
    client,
    quizId,
    traineeId,
    { lock = false } = {}
) {
    let query = `SELECT
           qa.attempt_id::INT AS attempt_id,
           qa.quiz_id::INT AS quiz_id,
           qa.trainee_id::INT AS trainee_id,
           qa.attempt_no::INT AS attempt_no,
           qa.status,
           qa.score_percent,
           qa.passed,
           qa.time_limit_seconds::INT AS time_limit_seconds,
           qa.started_at,
           qa.submitted_at,
           qa.created_at,
           qa.updated_at,
           q.status AS quiz_status,
           q.passing_score_percent::INT AS passing_score_percent,
           q.max_attempts::INT AS max_attempts,
           q.time_limit_minutes::INT AS time_limit_minutes
         FROM quiz_attempts qa
         JOIN quizzes q ON q.quiz_id = qa.quiz_id
         WHERE qa.quiz_id = $1
           AND qa.trainee_id = $2
           AND qa.status IN ($3, $4)
         ORDER BY COALESCE(qa.submitted_at, qa.started_at) DESC, qa.attempt_id DESC
         LIMIT 1`;

    if (lock) {
        query += ` FOR UPDATE OF qa`;
    }

    const result = await client.query(query, [
        quizId,
        traineeId,
        QUIZ_ATTEMPT_STATUS_SUBMITTED,
        QUIZ_ATTEMPT_STATUS_EXPIRED,
    ]);

    if (result.rowCount === 0) {
        return null;
    }

    return mapQuizAttemptRow(result.rows[0]);
}

function getQuizAttemptDeadlineState(attempt, now = Date.now()) {
    const startedAtMs = attempt?.started_at ? Date.parse(attempt.started_at) : NaN;
    const timeLimitSeconds = Number(attempt?.time_limit_seconds) || 0;

    if (!Number.isFinite(startedAtMs) || timeLimitSeconds < 1) {
        return {
            expires_at: attempt?.started_at || null,
            remaining_seconds: 0,
            is_expired: true,
        };
    }

    const expiresAtMs = startedAtMs + timeLimitSeconds * 1000;
    return {
        expires_at: new Date(expiresAtMs).toISOString(),
        remaining_seconds: Math.max(0, Math.ceil((expiresAtMs - now) / 1000)),
        is_expired: expiresAtMs <= now,
    };
}

function buildTraineeQuizAttemptPayload(attempt) {
    if (!attempt) return null;

    const deadline = getQuizAttemptDeadlineState(attempt);
    return {
        attempt_id: attempt.attempt_id,
        quiz_id: attempt.quiz_id,
        attempt_no: attempt.attempt_no,
        status: attempt.status,
        time_limit_seconds: attempt.time_limit_seconds,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        expires_at: deadline.expires_at,
        remaining_seconds: deadline.remaining_seconds,
    };
}

function buildTraineeQuizResultPayload(attempt) {
    if (!attempt) return null;
    if (
        attempt.status !== QUIZ_ATTEMPT_STATUS_SUBMITTED &&
        attempt.status !== QUIZ_ATTEMPT_STATUS_EXPIRED
    ) {
        return null;
    }
    if (attempt.passed == null) {
        return null;
    }

    return {
        attempt_id: attempt.attempt_id,
        quiz_id: attempt.quiz_id,
        attempt_no: attempt.attempt_no,
        status: attempt.status,
        passed: attempt.passed === true,
        submitted_at: attempt.submitted_at,
    };
}

function buildTraineeQuizSummaryPayload(
    quiz,
    { currentAttempt = null, latestResult = null, attemptsUsed = 0 } = {}
) {
    if (!quiz) return null;

    const safeAttemptsUsed = Math.max(0, Number(attemptsUsed) || 0);
    const attemptsRemaining = Math.max(0, (Number(quiz.max_attempts) || 0) - safeAttemptsUsed);

    return {
        ...quiz,
        attempts_used: safeAttemptsUsed,
        attempts_remaining: attemptsRemaining,
        current_attempt: buildTraineeQuizAttemptPayload(currentAttempt),
        latest_result: buildTraineeQuizResultPayload(latestResult),
        can_start: currentAttempt == null && attemptsRemaining > 0,
        can_resume: currentAttempt != null,
    };
}

async function finalizeExpiredQuizAttemptIfNeeded(client, attempt, { traineeId = null } = {}) {
    if (!attempt) {
        return {
            attempt: null,
            finalized: null,
            expired: false,
        };
    }

    const deadline = getQuizAttemptDeadlineState(attempt);
    if (!deadline.is_expired) {
        return {
            attempt,
            finalized: null,
            expired: false,
        };
    }

    const finalized = await finalizeQuizAttempt(client, attempt.attempt_id, {
        traineeId,
        status: QUIZ_ATTEMPT_STATUS_EXPIRED,
    });

    return {
        attempt: null,
        finalized,
        expired: true,
    };
}

async function requireModuleExists(client, moduleId) {
    const result = await client.query(
        `SELECT module_id::INT AS module_id
         FROM modules
         WHERE module_id = $1
         LIMIT 1`,
        [moduleId]
    );

    if (result.rowCount === 0) {
        throw createHttpError(404, "Module not found");
    }

    return result.rows[0];
}

async function requireQuizRow(client, quizId) {
    const result = await client.query(
        `SELECT
           quiz_id::INT AS quiz_id,
           module_id::INT AS module_id,
           cloned_from_quiz_id::INT AS cloned_from_quiz_id,
           title,
           status,
           passing_score_percent::INT AS passing_score_percent,
           max_attempts::INT AS max_attempts,
           time_limit_minutes::INT AS time_limit_minutes
         FROM quizzes
         WHERE quiz_id = $1
         FOR UPDATE`,
        [quizId]
    );

    if (result.rowCount === 0) {
        throw createHttpError(404, "Quiz not found");
    }

    return result.rows[0];
}

async function requireDraftQuizRow(client, quizId) {
    const quiz = await requireQuizRow(client, quizId);
    if (quiz.status !== QUIZ_STATUS_DRAFT) {
        throw createHttpError(409, "Only draft quizzes can be edited");
    }
    return quiz;
}

async function requireQuestionRow(client, quizId, questionId, { draftOnly = true } = {}) {
    const result = await client.query(
        `SELECT
           q.quiz_id::INT AS quiz_id,
           q.status,
           qq.question_id::INT AS question_id,
           qq.order_no::INT AS order_no
         FROM quizzes q
         JOIN quiz_questions qq ON qq.quiz_id = q.quiz_id
         WHERE q.quiz_id = $1
           AND qq.question_id = $2
         FOR UPDATE OF q, qq`,
        [quizId, questionId]
    );

    if (result.rowCount === 0) {
        throw createHttpError(404, "Question not found");
    }

    const row = result.rows[0];
    if (draftOnly && row.status !== QUIZ_STATUS_DRAFT) {
        throw createHttpError(409, "Only draft quizzes can be edited");
    }

    return row;
}

async function requireChoiceRow(client, quizId, questionId, choiceId, { draftOnly = true } = {}) {
    const result = await client.query(
        `SELECT
           q.quiz_id::INT AS quiz_id,
           q.status,
           qq.question_id::INT AS question_id,
           qc.choice_id::INT AS choice_id,
           qc.choice_no::INT AS choice_no
         FROM quizzes q
         JOIN quiz_questions qq ON qq.quiz_id = q.quiz_id
         JOIN quiz_choices qc ON qc.question_id = qq.question_id
         WHERE q.quiz_id = $1
           AND qq.question_id = $2
           AND qc.choice_id = $3
         FOR UPDATE OF q, qq, qc`,
        [quizId, questionId, choiceId]
    );

    if (result.rowCount === 0) {
        throw createHttpError(404, "Choice not found");
    }

    const row = result.rows[0];
    if (draftOnly && row.status !== QUIZ_STATUS_DRAFT) {
        throw createHttpError(409, "Only draft quizzes can be edited");
    }

    return row;
}

async function loadOrderedQuizQuestionIds(client, quizId) {
    const result = await client.query(
        `SELECT question_id::INT AS question_id
         FROM quiz_questions
         WHERE quiz_id = $1
         ORDER BY order_no, question_id
         FOR UPDATE`,
        [quizId]
    );

    return result.rows
        .map((row) => Number(row.question_id))
        .filter((value) => Number.isInteger(value) && value > 0);
}

async function renumberQuizQuestions(client, quizId, orderedQuestionIds = null) {
    const questionIds = Array.isArray(orderedQuestionIds)
        ? orderedQuestionIds
        : await loadOrderedQuizQuestionIds(client, quizId);

    for (let index = 0; index < questionIds.length; index += 1) {
        await client.query(
            `UPDATE quiz_questions
             SET order_no = $2,
                 updated_at = NOW()
             WHERE question_id = $1`,
            [questionIds[index], index + 1]
        );
    }
}

async function loadOrderedQuizChoiceIds(client, questionId) {
    const result = await client.query(
        `SELECT choice_id::INT AS choice_id
         FROM quiz_choices
         WHERE question_id = $1
         ORDER BY choice_no, choice_id
         FOR UPDATE`,
        [questionId]
    );

    return result.rows
        .map((row) => Number(row.choice_id))
        .filter((value) => Number.isInteger(value) && value > 0);
}

async function renumberQuizChoices(client, questionId, orderedChoiceIds = null) {
    const choiceIds = Array.isArray(orderedChoiceIds)
        ? orderedChoiceIds
        : await loadOrderedQuizChoiceIds(client, questionId);

    for (let index = 0; index < choiceIds.length; index += 1) {
        await client.query(
            `UPDATE quiz_choices
             SET choice_no = $2,
                 updated_at = NOW()
             WHERE choice_id = $1`,
            [choiceIds[index], index + 1]
        );
    }
}

async function getQuizAttemptByQuizAndTrainee(
    client,
    quizId,
    traineeId,
    { status = null, lock = false } = {}
) {
    const params = [quizId, traineeId];
    let query = `SELECT
           qa.attempt_id::INT AS attempt_id,
           qa.quiz_id::INT AS quiz_id,
           qa.trainee_id::INT AS trainee_id,
           qa.attempt_no::INT AS attempt_no,
           qa.status,
           qa.score_percent,
           qa.passed,
           qa.time_limit_seconds::INT AS time_limit_seconds,
           qa.started_at,
           qa.submitted_at,
           qa.created_at,
           qa.updated_at,
           q.status AS quiz_status,
           q.passing_score_percent::INT AS passing_score_percent,
           q.max_attempts::INT AS max_attempts,
           q.time_limit_minutes::INT AS time_limit_minutes
         FROM quiz_attempts qa
         JOIN quizzes q ON q.quiz_id = qa.quiz_id
         WHERE qa.quiz_id = $1
           AND qa.trainee_id = $2`;

    if (status) {
        params.push(status);
        query += ` AND qa.status = $${params.length}`;
    }

    query += ` ORDER BY qa.started_at DESC, qa.attempt_id DESC
         LIMIT 1`;

    if (lock) {
        query += ` FOR UPDATE OF qa`;
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
        return null;
    }

    return mapQuizAttemptRow(result.rows[0]);
}

async function requireQuizAttemptRow(client, attemptId, { traineeId = null, lock = false } = {}) {
    const params = [attemptId];
    let query = `SELECT
           qa.attempt_id::INT AS attempt_id,
           qa.quiz_id::INT AS quiz_id,
           qa.trainee_id::INT AS trainee_id,
           qa.attempt_no::INT AS attempt_no,
           qa.status,
           qa.score_percent,
           qa.passed,
           qa.time_limit_seconds::INT AS time_limit_seconds,
           qa.started_at,
           qa.submitted_at,
           qa.created_at,
           qa.updated_at,
           q.status AS quiz_status,
           q.passing_score_percent::INT AS passing_score_percent,
           q.max_attempts::INT AS max_attempts,
           q.time_limit_minutes::INT AS time_limit_minutes
         FROM quiz_attempts qa
         JOIN quizzes q ON q.quiz_id = qa.quiz_id
         WHERE qa.attempt_id = $1`;

    if (traineeId !== null) {
        params.push(traineeId);
        query += ` AND qa.trainee_id = $${params.length}`;
    }

    if (lock) {
        query += ` FOR UPDATE OF qa`;
    }

    const result = await client.query(query, params);
    if (result.rowCount === 0) {
        throw createHttpError(404, "Quiz attempt not found");
    }

    return mapQuizAttemptRow(result.rows[0]);
}

async function requireInProgressQuizAttemptRow(client, attemptId, options = {}) {
    const attempt = await requireQuizAttemptRow(client, attemptId, { ...options, lock: true });
    if (attempt.status !== QUIZ_ATTEMPT_STATUS_IN_PROGRESS) {
        throw createHttpError(409, "Only in-progress quiz attempts can be changed");
    }
    return attempt;
}

async function getQuizAttemptSavedAnswers(client, attemptId) {
    const result = await client.query(
        `SELECT
           qaa.attempt_id::INT AS attempt_id,
           qaa.question_id::INT AS question_id,
           qq.order_no::INT AS question_order_no,
           qaa.selected_choice_id::INT AS selected_choice_id,
           qaa.created_at,
           qaa.updated_at
         FROM quiz_attempt_answers qaa
         JOIN quiz_questions qq ON qq.question_id = qaa.question_id
         WHERE qaa.attempt_id = $1
         ORDER BY qq.order_no, qaa.question_id`,
        [attemptId]
    );

    return result.rows.map(mapQuizAttemptAnswerRow);
}

async function getOrCreateInProgressQuizAttempt(client, quizId, traineeId) {
    const existingAttempt = await getQuizAttemptByQuizAndTrainee(client, quizId, traineeId, {
        status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
        lock: true,
    });
    if (existingAttempt) {
        return {
            attempt: existingAttempt,
            created: false,
        };
    }

    const quiz = await requireQuizRow(client, quizId);
    if (quiz.status !== QUIZ_STATUS_PUBLISHED) {
        throw createHttpError(409, "Only published quizzes can be attempted");
    }

    const attemptCountResult = await client.query(
        `SELECT COALESCE(MAX(attempt_no), 0)::INT + 1 AS next_attempt_no
         FROM quiz_attempts
         WHERE quiz_id = $1
           AND trainee_id = $2`,
        [quizId, traineeId]
    );
    const nextAttemptNo = Number(attemptCountResult.rows[0]?.next_attempt_no) || 1;
    if (nextAttemptNo > quiz.max_attempts) {
        throw createHttpError(409, "Maximum quiz attempts reached");
    }

    try {
        const insertResult = await client.query(
            `INSERT INTO quiz_attempts (
               quiz_id,
               trainee_id,
               attempt_no,
               status,
               time_limit_seconds
             )
             VALUES ($1, $2, $3, $4, $5)
             RETURNING
               attempt_id::INT AS attempt_id,
               quiz_id::INT AS quiz_id,
               trainee_id::INT AS trainee_id,
               attempt_no::INT AS attempt_no,
               status,
               score_percent,
               passed,
               time_limit_seconds::INT AS time_limit_seconds,
               started_at,
               submitted_at,
               created_at,
               updated_at`,
            [
                quizId,
                traineeId,
                nextAttemptNo,
                QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
                quiz.time_limit_minutes * 60,
            ]
        );

        return {
            attempt: mapQuizAttemptRow({
                ...insertResult.rows[0],
                quiz_status: quiz.status,
                passing_score_percent: quiz.passing_score_percent,
                max_attempts: quiz.max_attempts,
                time_limit_minutes: quiz.time_limit_minutes,
            }),
            created: true,
        };
    } catch (error) {
        if (error?.code === "23505") {
            const conflictedAttempt = await getQuizAttemptByQuizAndTrainee(client, quizId, traineeId, {
                status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
                lock: true,
            });
            if (conflictedAttempt) {
                return {
                    attempt: conflictedAttempt,
                    created: false,
                };
            }
        }

        throw error;
    }
}

async function saveQuizAttemptAnswer(client, attemptId, questionId, selectedChoiceId, { traineeId = null } = {}) {
    const safeQuestionId = parsePositiveIntParam(questionId);
    const safeSelectedChoiceId = parsePositiveIntParam(selectedChoiceId);
    if (!safeQuestionId) {
        throw createHttpError(400, "Invalid question id");
    }
    if (!safeSelectedChoiceId) {
        throw createHttpError(400, "Invalid selected choice id");
    }

    const attempt = await requireInProgressQuizAttemptRow(client, attemptId, { traineeId });
    const targetResult = await client.query(
        `SELECT
           qq.question_id::INT AS question_id,
           qq.order_no::INT AS question_order_no
         FROM quiz_questions qq
         JOIN quiz_choices qc ON qc.question_id = qq.question_id
         WHERE qq.quiz_id = $1
           AND qq.question_id = $2
           AND qc.choice_id = $3
         LIMIT 1`,
        [attempt.quiz_id, safeQuestionId, safeSelectedChoiceId]
    );
    if (targetResult.rowCount === 0) {
        throw createHttpError(404, "Quiz question or choice not found");
    }

    const answerResult = await client.query(
        `INSERT INTO quiz_attempt_answers (
           attempt_id,
           question_id,
           selected_choice_id
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET
           selected_choice_id = EXCLUDED.selected_choice_id,
           updated_at = NOW()
         RETURNING
           attempt_id::INT AS attempt_id,
           question_id::INT AS question_id,
           selected_choice_id::INT AS selected_choice_id,
           created_at,
           updated_at`,
        [attempt.attempt_id, safeQuestionId, safeSelectedChoiceId]
    );

    await client.query(
        `UPDATE quiz_attempts
         SET updated_at = NOW()
         WHERE attempt_id = $1`,
        [attempt.attempt_id]
    );

    return mapQuizAttemptAnswerRow({
        ...answerResult.rows[0],
        question_order_no: Number(targetResult.rows[0]?.question_order_no) || 0,
    });
}

function calculateQuizScorePercent(correctAnswers, totalQuestions) {
    const safeCorrectAnswers = Number(correctAnswers);
    const safeTotalQuestions = Number(totalQuestions);

    if (!Number.isInteger(safeTotalQuestions) || safeTotalQuestions < 1) {
        return 0;
    }

    if (!Number.isInteger(safeCorrectAnswers) || safeCorrectAnswers < 0) {
        return 0;
    }

    return Math.round((safeCorrectAnswers / safeTotalQuestions) * 10000) / 100;
}

async function calculateQuizAttemptOutcome(client, attemptId) {
    const result = await client.query(
        `SELECT
           COUNT(qq.question_id)::INT AS total_questions,
           COUNT(qaa.question_id)::INT AS answered_questions,
           COALESCE(SUM(CASE WHEN qaa.selected_choice_id = qc.choice_id THEN 1 ELSE 0 END), 0)::INT AS correct_answers
         FROM quiz_attempts qa
         LEFT JOIN quiz_questions qq ON qq.quiz_id = qa.quiz_id
         LEFT JOIN quiz_choices qc
           ON qc.question_id = qq.question_id
          AND qc.is_correct = TRUE
         LEFT JOIN quiz_attempt_answers qaa
           ON qaa.attempt_id = qa.attempt_id
          AND qaa.question_id = qq.question_id
         WHERE qa.attempt_id = $1
         GROUP BY qa.attempt_id`,
        [attemptId]
    );

    if (result.rowCount === 0) {
        throw createHttpError(404, "Quiz attempt not found");
    }

    const row = result.rows[0];
    const totalQuestions = Number(row.total_questions) || 0;
    const answeredQuestions = Number(row.answered_questions) || 0;
    const correctAnswers = Number(row.correct_answers) || 0;
    const scorePercent = calculateQuizScorePercent(correctAnswers, totalQuestions);

    return {
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        correct_answers: correctAnswers,
        score_percent: scorePercent,
        passed: totalQuestions > 0 && scorePercent >= QUIZ_PASSING_SCORE_PERCENT,
    };
}

async function finalizeQuizAttempt(
    client,
    attemptId,
    { traineeId = null, status = QUIZ_ATTEMPT_STATUS_SUBMITTED } = {}
) {
    if (status !== QUIZ_ATTEMPT_STATUS_SUBMITTED && status !== QUIZ_ATTEMPT_STATUS_EXPIRED) {
        throw createHttpError(400, "Invalid final quiz attempt status");
    }

    const attempt = await requireInProgressQuizAttemptRow(client, attemptId, { traineeId });
    const outcome = await calculateQuizAttemptOutcome(client, attempt.attempt_id);
    const updateResult = await client.query(
        `UPDATE quiz_attempts
         SET status = $2,
             score_percent = $3,
             passed = $4,
             submitted_at = NOW(),
             updated_at = NOW()
         WHERE attempt_id = $1
         RETURNING
           attempt_id::INT AS attempt_id,
           quiz_id::INT AS quiz_id,
           trainee_id::INT AS trainee_id,
           attempt_no::INT AS attempt_no,
           status,
           score_percent,
           passed,
           time_limit_seconds::INT AS time_limit_seconds,
           started_at,
           submitted_at,
           created_at,
           updated_at`,
        [attempt.attempt_id, status, outcome.score_percent, outcome.passed]
    );

    return {
        attempt: mapQuizAttemptRow({
            ...updateResult.rows[0],
            quiz_status: attempt.quiz_status,
            passing_score_percent: attempt.passing_score_percent,
            max_attempts: attempt.max_attempts,
            time_limit_minutes: attempt.time_limit_minutes,
        }),
        outcome,
    };
}

app.get("/api/admin/simulations", requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT simulation_id::INT, simulation_code, title, module_id::INT
             FROM simulations
             ORDER BY simulation_code, title`
        );
        res.json({ simulations: result.rows });
    } catch (error) {
        console.error("Admin simulations fetch failed:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.put("/api/admin/modules/:moduleId/simulations", requireAuth, requireAdmin, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const { simulationIds } = req.body;
    if (!Array.isArray(simulationIds)) {
        return res.status(400).json({ error: "simulationIds must be an array" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        
        // 🔥 Self-healing DB patch: Allow simulations to sit in an unassigned pool
        await client.query(`ALTER TABLE simulations ALTER COLUMN module_id DROP NOT NULL`)
            .catch(e => console.warn("Notice: Could not auto-drop constraint. You may need to run this manually in Supabase."));

        // Unassign existing simulations for this module
        await client.query(`UPDATE simulations SET module_id = NULL WHERE module_id = $1`, [moduleId]);

        // Assign the newly selected ones
        const safeIds = simulationIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
        if (safeIds.length > 0) {
            await client.query(
                `UPDATE simulations SET module_id = $1 WHERE simulation_id = ANY($2::INT[])`,
                [moduleId, safeIds]
            );
        }

        const modRes = await client.query(`SELECT module_code FROM modules WHERE module_id = $1`, [moduleId]);
        const moduleCode = modRes.rows[0]?.module_code || moduleId;

        await logAdminAction(client, req.user?.account_id || req.auth?.account_id || null, 'admin_simulation_moved', null, `Updated simulation assignments for Module ${moduleCode} (${safeIds.length} mapped)`, { module_id: moduleId, simulations: safeIds });

        await client.query("COMMIT");
        invalidateAdminCaches();
        
        const [item] = await getAdminLessonItems(moduleId);
        res.json({ item });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Admin update module simulations failed:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

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
                t.email, t.contact_number, t.address, t.birth_date, b.batch_code,
                a.access_mode
         FROM trainees t
         JOIN batches b ON b.batch_id = t.batch_id
         JOIN accounts a ON a.trainee_id = t.trainee_id
         WHERE t.trainee_id = $1`,
        [traineeId]
    );

    if (profile.rows.length === 0) return null;

    const traineeProfile = {
        ...profile.rows[0],
        access_mode: normalizeAccountAccessMode(profile.rows[0]?.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD,
    };
    const canAccessSimulationsForTrainee = canAccessSimulationFeatures(traineeProfile.access_mode);

    const [moduleStatus, moduleContent, simulationProgress] = await Promise.all([
        pool.query(
            `SELECT module_id, module_code, module_title, required_sims, completed_required_sims, module_status
             FROM v_trainee_module_status
             WHERE trainee_id = $1
             ORDER BY module_id`,
            [traineeId]
        ),
        getCurriculumContent({ includeSimulations: canAccessSimulationsForTrainee }),
        canAccessSimulationsForTrainee
            ? pool.query(
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
            )
            : Promise.resolve({ rows: [] }),
    ]);

    return {
        trainee: traineeProfile,
        moduleStatus: moduleStatus.rows,
        moduleContent,
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
        const password = typeof req.body?.password === "string" ? req.body.password.trim() : req.body?.password;

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

app.post("/api/auth/forgot-password", async (req, res) => {
    const client = await pool.connect();
    try {
        const email = normalizeEmail(req.body?.email);

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const result = await client.query(
            `SELECT a.account_id, a.role, a.trainee_id, t.first_name, t.middle_name, t.last_name, b.batch_code
             FROM accounts a
             LEFT JOIN trainees t ON t.trainee_id = a.trainee_id
             LEFT JOIN batches b ON b.batch_id = t.batch_id
             WHERE lower(a.login_email) = $1 AND a.is_active = TRUE AND a.role = 'trainee'
             LIMIT 1`,
            [email]
        );

        if (result.rowCount === 0) {
            return res.json({ message: "If an active trainee account with that email exists, new credentials have been sent." });
        }

        const account = result.rows[0];
        const generatedPassword = generateStrongPassword();
        const passwordHash = await bcrypt.hash(generatedPassword, 10);

        await client.query(
            `UPDATE accounts SET password_hash = $1 WHERE account_id = $2`,
            [passwordHash, account.account_id]
        );

        const traineeName = [account.first_name, account.middle_name, account.last_name].filter(Boolean).join(" ").trim() || "Trainee";

        try {
            await sendTraineeCredentialsEmail({
                to: email,
                traineeName,
                loginEmail: email,
                password: generatedPassword,
                batchCode: account.batch_code || ""
            });
        } catch (mailError) {
            console.error("Forgot password email failed:", mailError);
            return res.status(500).json({ error: "Failed to send email. Please try again later." });
        }

        res.json({ message: "If an active trainee account with that email exists, new credentials have been sent." });

    } catch (e) {
        console.error("Forgot password endpoint failed:", e);
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

app.get("/api/admin/quizzes", async (req, res) => {
    try {
        const [items, modules] = await Promise.all([
            getAdminQuizSummaryItems(),
            getAdminQuizModuleOptions(),
        ]);
        return res.json({ items, modules });
    } catch (error) {
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }
        console.error("Admin quizzes listing endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/quizzes", async (req, res) => {
    const quizBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};

    const moduleId = normalizeQuizPositiveInt(quizBody.module_id);
    const title = normalizeQuizTitle(quizBody.title);
    const maxAttempts = normalizeQuizPositiveInt(quizBody.max_attempts);
    const timeLimitMinutes = normalizeQuizPositiveInt(quizBody.time_limit_minutes);

    if (!moduleId) return res.status(400).json({ error: "A valid module_id is required" });
    if (!title) {
        return res.status(400).json({ error: `Quiz title is required and must be at most ${QUIZ_TITLE_MAX_LENGTH} characters` });
    }
    if (!maxAttempts) return res.status(400).json({ error: "max_attempts must be a positive integer" });
    if (!timeLimitMinutes) return res.status(400).json({ error: "time_limit_minutes must be a positive integer" });

    const client = await pool.connect();
    let createdQuizId = null;
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const insertResult = await client.query(
            `INSERT INTO quizzes (
               module_id,
               title,
               passing_score_percent,
               max_attempts,
               time_limit_minutes,
               status
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING quiz_id::INT AS quiz_id`,
            [
                moduleId,
                title,
                QUIZ_PASSING_SCORE_PERCENT,
                maxAttempts,
                timeLimitMinutes,
                QUIZ_STATUS_DRAFT,
            ]
        );

        createdQuizId = Number(insertResult.rows[0]?.quiz_id) || null;
        if (!createdQuizId) {
            throw createHttpError(500, "Failed to create quiz");
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz create:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz create endpoint failed:", error);
        return res.status(500).json({ error: "Failed to create quiz" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(createdQuizId);
        return res.status(201).json({ quiz });
    } catch (error) {
        console.error("Admin quiz create follow-up load failed:", error);
        return res.status(201).json({ quiz: null });
    }
});

app.get("/api/admin/quizzes/:quizId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    try {
        const quiz = await getAdminQuizDetail(quizId);
        if (!quiz) return res.status(404).json({ error: "Quiz not found" });
        return res.json({ quiz });
    } catch (error) {
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }
        console.error("Admin quiz detail endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.patch("/api/admin/quizzes/:quizId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const quizBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const hasTitle = Object.prototype.hasOwnProperty.call(quizBody, "title");
    const hasModuleId = Object.prototype.hasOwnProperty.call(quizBody, "module_id");
    const hasMaxAttempts = Object.prototype.hasOwnProperty.call(quizBody, "max_attempts");
    const hasTimeLimit = Object.prototype.hasOwnProperty.call(quizBody, "time_limit_minutes");

    if (!hasTitle && !hasModuleId && !hasMaxAttempts && !hasTimeLimit) {
        return res.status(400).json({ error: "At least one draft quiz field must be provided" });
    }

    const title = hasTitle ? normalizeQuizTitle(quizBody.title) : null;
    const moduleId = hasModuleId ? normalizeQuizPositiveInt(quizBody.module_id) : null;
    const maxAttempts = hasMaxAttempts ? normalizeQuizPositiveInt(quizBody.max_attempts) : null;
    const timeLimitMinutes = hasTimeLimit ? normalizeQuizPositiveInt(quizBody.time_limit_minutes) : null;

    if (hasTitle && !title) {
        return res.status(400).json({ error: `Quiz title must be at most ${QUIZ_TITLE_MAX_LENGTH} characters` });
    }
    if (hasModuleId && !moduleId) return res.status(400).json({ error: "module_id must be a positive integer" });
    if (hasMaxAttempts && !maxAttempts) return res.status(400).json({ error: "max_attempts must be a positive integer" });
    if (hasTimeLimit && !timeLimitMinutes) {
        return res.status(400).json({ error: "time_limit_minutes must be a positive integer" });
    }

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");

        const quiz = await requireDraftQuizRow(client, quizId);
        if (moduleId) {
            await requireModuleExists(client, moduleId);
        }

        await client.query(
            `UPDATE quizzes
             SET module_id = $2,
                 title = $3,
                 max_attempts = $4,
                 time_limit_minutes = $5,
                 updated_at = NOW()
             WHERE quiz_id = $1`,
            [
                quizId,
                moduleId || quiz.module_id,
                title || quiz.title,
                maxAttempts || quiz.max_attempts,
                timeLimitMinutes || quiz.time_limit_minutes,
            ]
        );

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz update:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz update endpoint failed:", error);
        return res.status(500).json({ error: "Failed to update quiz" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz });
    } catch (error) {
        console.error("Admin quiz update follow-up load failed:", error);
        return res.json({ quiz: null });
    }
});

app.post("/api/admin/quizzes/:quizId/questions", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const questionBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const questionText = normalizeQuizQuestionText(questionBody.question_text ?? questionBody.text);
    if (!questionText) {
        return res.status(400).json({
            error: `question_text is required and must be at most ${QUIZ_QUESTION_TEXT_MAX_LENGTH} characters`,
        });
    }

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireDraftQuizRow(client, quizId);

        const nextOrderResult = await client.query(
            `SELECT COALESCE(MAX(order_no), 0)::INT + 1 AS next_order
             FROM quiz_questions
             WHERE quiz_id = $1`,
            [quizId]
        );
        const nextOrder = Number(nextOrderResult.rows[0]?.next_order) || 1;

        await client.query(
            `INSERT INTO quiz_questions (quiz_id, question_text, order_no)
             VALUES ($1, $2, $3)`,
            [quizId, questionText, nextOrder]
        );

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz question create:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz question create endpoint failed:", error);
        return res.status(500).json({ error: "Failed to add question" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.status(201).json({ quiz });
    } catch (error) {
        console.error("Admin quiz question create follow-up load failed:", error);
        return res.status(201).json({ quiz: null });
    }
});

app.patch("/api/admin/quizzes/:quizId/questions/:questionId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });

    const questionBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const hasQuestionText =
        Object.prototype.hasOwnProperty.call(questionBody, "question_text") ||
        Object.prototype.hasOwnProperty.call(questionBody, "text");
    const hasOrderNo = Object.prototype.hasOwnProperty.call(questionBody, "order_no");
    if (!hasQuestionText && !hasOrderNo) {
        return res.status(400).json({ error: "At least one of question_text or order_no is required" });
    }

    const questionText = hasQuestionText
        ? normalizeQuizQuestionText(questionBody.question_text ?? questionBody.text)
        : null;
    const orderNo = hasOrderNo ? normalizeQuizPositiveInt(questionBody.order_no) : null;

    if (hasQuestionText && !questionText) {
        return res.status(400).json({
            error: `question_text must be at most ${QUIZ_QUESTION_TEXT_MAX_LENGTH} characters`,
        });
    }
    if (hasOrderNo && !orderNo) return res.status(400).json({ error: "order_no must be a positive integer" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");

        await requireQuestionRow(client, quizId, questionId, { draftOnly: true });

        if (questionText) {
            await client.query(
                `UPDATE quiz_questions
                 SET question_text = $2,
                     updated_at = NOW()
                 WHERE question_id = $1`,
                [questionId, questionText]
            );
        }

        if (orderNo) {
            const orderedQuestionIds = await loadOrderedQuizQuestionIds(client, quizId);
            const currentIndex = orderedQuestionIds.indexOf(questionId);
            if (currentIndex >= 0) {
                orderedQuestionIds.splice(currentIndex, 1);
                const targetIndex = Math.max(0, Math.min(orderNo - 1, orderedQuestionIds.length));
                orderedQuestionIds.splice(targetIndex, 0, questionId);
                await renumberQuizQuestions(client, quizId, orderedQuestionIds);
            }
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz question update:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz question update endpoint failed:", error);
        return res.status(500).json({ error: "Failed to update question" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz });
    } catch (error) {
        console.error("Admin quiz question update follow-up load failed:", error);
        return res.json({ quiz: null });
    }
});

app.delete("/api/admin/quizzes/:quizId/questions/:questionId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireQuestionRow(client, quizId, questionId, { draftOnly: true });

        await client.query(`DELETE FROM quiz_questions WHERE question_id = $1`, [questionId]);
        await renumberQuizQuestions(client, quizId);

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz question delete:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz question delete endpoint failed:", error);
        return res.status(500).json({ error: "Failed to delete question" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz, removed: true });
    } catch (error) {
        console.error("Admin quiz question delete follow-up load failed:", error);
        return res.json({ quiz: null, removed: true });
    }
});

app.post("/api/admin/quizzes/:quizId/questions/:questionId/choices", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });

    const choiceBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const choiceText = normalizeQuizChoiceText(choiceBody.choice_text ?? choiceBody.text);
    const isCorrect = choiceBody.is_correct === true;

    if (!choiceText) {
        return res.status(400).json({
            error: `choice_text is required and must be at most ${QUIZ_CHOICE_TEXT_MAX_LENGTH} characters`,
        });
    }

    const client = await pool.connect();
    let committed = false;
    let createdChoiceId = null;

    try {
        await client.query("BEGIN");
        await requireQuestionRow(client, quizId, questionId, { draftOnly: true });

        const orderedChoiceIds = await loadOrderedQuizChoiceIds(client, questionId);
        if (orderedChoiceIds.length >= QUIZ_MAX_CHOICES_PER_QUESTION) {
            throw createHttpError(409, `Each question may have at most ${QUIZ_MAX_CHOICES_PER_QUESTION} choices`);
        }

        const insertResult = await client.query(
            `INSERT INTO quiz_choices (question_id, choice_no, choice_text, is_correct)
             VALUES ($1, $2, $3, FALSE)
             RETURNING choice_id::INT AS choice_id`,
            [questionId, orderedChoiceIds.length + 1, choiceText]
        );
        createdChoiceId = Number(insertResult.rows[0]?.choice_id) || null;

        if (isCorrect && createdChoiceId) {
            await client.query(
                `UPDATE quiz_choices
                 SET is_correct = FALSE,
                     updated_at = NOW()
                 WHERE question_id = $1
                   AND choice_id <> $2
                   AND is_correct = TRUE`,
                [questionId, createdChoiceId]
            );
            await client.query(
                `UPDATE quiz_choices
                 SET is_correct = TRUE,
                     updated_at = NOW()
                 WHERE choice_id = $1`,
                [createdChoiceId]
            );
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz choice create:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz choice create endpoint failed:", error);
        return res.status(500).json({ error: "Failed to add choice" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.status(201).json({ quiz });
    } catch (error) {
        console.error("Admin quiz choice create follow-up load failed:", error);
        return res.status(201).json({ quiz: null });
    }
});

app.patch("/api/admin/quizzes/:quizId/questions/:questionId/choices/:choiceId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    const choiceId = parsePositiveIntParam(req.params.choiceId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });
    if (!choiceId) return res.status(400).json({ error: "Invalid choice id" });

    const choiceBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const hasChoiceText =
        Object.prototype.hasOwnProperty.call(choiceBody, "choice_text") ||
        Object.prototype.hasOwnProperty.call(choiceBody, "text");
    const hasIsCorrect = Object.prototype.hasOwnProperty.call(choiceBody, "is_correct");
    if (!hasChoiceText && !hasIsCorrect) {
        return res.status(400).json({ error: "At least one of choice_text or is_correct is required" });
    }

    const choiceText = hasChoiceText
        ? normalizeQuizChoiceText(choiceBody.choice_text ?? choiceBody.text)
        : null;
    if (hasChoiceText && !choiceText) {
        return res.status(400).json({
            error: `choice_text must be at most ${QUIZ_CHOICE_TEXT_MAX_LENGTH} characters`,
        });
    }
    if (hasIsCorrect && typeof choiceBody.is_correct !== "boolean") {
        return res.status(400).json({ error: "is_correct must be a boolean" });
    }

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireChoiceRow(client, quizId, questionId, choiceId, { draftOnly: true });

        if (choiceText) {
            await client.query(
                `UPDATE quiz_choices
                 SET choice_text = $2,
                     updated_at = NOW()
                 WHERE choice_id = $1`,
                [choiceId, choiceText]
            );
        }

        if (hasIsCorrect) {
            if (choiceBody.is_correct === true) {
                await client.query(
                    `UPDATE quiz_choices
                     SET is_correct = FALSE,
                         updated_at = NOW()
                     WHERE question_id = $1
                       AND choice_id <> $2
                       AND is_correct = TRUE`,
                    [questionId, choiceId]
                );
                await client.query(
                    `UPDATE quiz_choices
                     SET is_correct = TRUE,
                         updated_at = NOW()
                     WHERE choice_id = $1`,
                    [choiceId]
                );
            } else {
                await client.query(
                    `UPDATE quiz_choices
                     SET is_correct = FALSE,
                         updated_at = NOW()
                     WHERE choice_id = $1`,
                    [choiceId]
                );
            }
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz choice update:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz choice update endpoint failed:", error);
        return res.status(500).json({ error: "Failed to update choice" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz });
    } catch (error) {
        console.error("Admin quiz choice update follow-up load failed:", error);
        return res.json({ quiz: null });
    }
});

app.delete("/api/admin/quizzes/:quizId/questions/:questionId/choices/:choiceId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    const choiceId = parsePositiveIntParam(req.params.choiceId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });
    if (!choiceId) return res.status(400).json({ error: "Invalid choice id" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireChoiceRow(client, quizId, questionId, choiceId, { draftOnly: true });

        await client.query(`DELETE FROM quiz_choices WHERE choice_id = $1`, [choiceId]);
        await renumberQuizChoices(client, questionId);

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz choice delete:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz choice delete endpoint failed:", error);
        return res.status(500).json({ error: "Failed to delete choice" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz, removed: true });
    } catch (error) {
        console.error("Admin quiz choice delete follow-up load failed:", error);
        return res.json({ quiz: null, removed: true });
    }
});

app.post("/api/admin/quizzes/:quizId/publish", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        const quiz = await requireDraftQuizRow(client, quizId);
        const detail = await getAdminQuizDetail(quizId, client);
        const publishChecks = buildQuizPublishChecks(detail);
        if (!publishChecks.ready) {
            throw createHttpError(400, "Quiz is not ready to publish", publishChecks.errors);
        }

        const publishedForModuleResult = await client.query(
            `SELECT quiz_id::INT AS quiz_id
             FROM quizzes
             WHERE module_id = $1
               AND status = $2
               AND quiz_id <> $3
             FOR UPDATE`,
            [quiz.module_id, QUIZ_STATUS_PUBLISHED, quizId]
        );
        if (publishedForModuleResult.rowCount > 0) {
            throw createHttpError(
                409,
                "This module already has a published quiz. Archive it before publishing another one."
            );
        }

        await client.query(
            `UPDATE quizzes
             SET status = $2,
                 published_at = NOW(),
                 archived_at = NULL,
                 updated_at = NOW()
             WHERE quiz_id = $1`,
            [quizId, QUIZ_STATUS_PUBLISHED]
        );

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz publish:", rollbackError);
            }
        }

        if (error?.statusCode) {
            const payload = { error: error.message };
            if (Array.isArray(error.details) && error.details.length > 0) {
                payload.details = error.details;
            }
            return res.status(error.statusCode).json(payload);
        }
        if (error?.code === "23505") {
            return res.status(409).json({
                error: "This module already has a published quiz. Archive it before publishing another one.",
            });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz publish endpoint failed:", error);
        return res.status(500).json({ error: "Failed to publish quiz" });
    } finally {
        client.release();
    }

    invalidateAdminCaches();
    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz });
    } catch (error) {
        console.error("Admin quiz publish follow-up load failed:", error);
        return res.json({ quiz: null });
    }
});

app.post("/api/admin/quizzes/:quizId/archive", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        const quiz = await requireQuizRow(client, quizId);
        if (quiz.status !== QUIZ_STATUS_PUBLISHED) {
            throw createHttpError(409, "Only published quizzes can be archived");
        }

        await client.query(
            `UPDATE quizzes
             SET status = $2,
                 archived_at = NOW(),
                 updated_at = NOW()
             WHERE quiz_id = $1`,
            [quizId, QUIZ_STATUS_ARCHIVED]
        );

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz archive:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz archive endpoint failed:", error);
        return res.status(500).json({ error: "Failed to archive quiz" });
    } finally {
        client.release();
    }

    invalidateAdminCaches();
    try {
        const quiz = await getAdminQuizDetail(quizId);
        return res.json({ quiz });
    } catch (error) {
        console.error("Admin quiz archive follow-up load failed:", error);
        return res.json({ quiz: null });
    }
});

app.post("/api/admin/quizzes/:quizId/clone", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const client = await pool.connect();
    let committed = false;
    let createdQuizId = null;

    try {
        await client.query("BEGIN");
        const sourceQuiz = await requireQuizRow(client, quizId);

        const insertQuizResult = await client.query(
            `INSERT INTO quizzes (
               module_id,
               cloned_from_quiz_id,
               title,
               passing_score_percent,
               max_attempts,
               time_limit_minutes,
               status
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING quiz_id::INT AS quiz_id`,
            [
                sourceQuiz.module_id,
                sourceQuiz.quiz_id,
                buildDraftCloneQuizTitle(sourceQuiz.title),
                QUIZ_PASSING_SCORE_PERCENT,
                sourceQuiz.max_attempts,
                sourceQuiz.time_limit_minutes,
                QUIZ_STATUS_DRAFT,
            ]
        );

        createdQuizId = Number(insertQuizResult.rows[0]?.quiz_id) || null;
        if (!createdQuizId) {
            throw createHttpError(500, "Failed to clone quiz");
        }

        const questionRowsResult = await client.query(
            `SELECT question_id::INT AS question_id, question_text, order_no::INT AS order_no
             FROM quiz_questions
             WHERE quiz_id = $1
             ORDER BY order_no, question_id`,
            [quizId]
        );

        for (const questionRow of questionRowsResult.rows) {
            const insertedQuestionResult = await client.query(
                `INSERT INTO quiz_questions (quiz_id, question_text, order_no)
                 VALUES ($1, $2, $3)
                 RETURNING question_id::INT AS question_id`,
                [createdQuizId, questionRow.question_text, questionRow.order_no]
            );
            const createdQuestionId = Number(insertedQuestionResult.rows[0]?.question_id) || null;
            if (!createdQuestionId) {
                throw createHttpError(500, "Failed to clone quiz question");
            }

            const choiceRowsResult = await client.query(
                `SELECT choice_no::INT AS choice_no, choice_text, is_correct
                 FROM quiz_choices
                 WHERE question_id = $1
                 ORDER BY choice_no, choice_id`,
                [questionRow.question_id]
            );

            for (const choiceRow of choiceRowsResult.rows) {
                await client.query(
                    `INSERT INTO quiz_choices (question_id, choice_no, choice_text, is_correct)
                     VALUES ($1, $2, $3, $4)`,
                    [createdQuestionId, choiceRow.choice_no, choiceRow.choice_text, choiceRow.is_correct === true]
                );
            }
        }

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz clone:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz clone endpoint failed:", error);
        return res.status(500).json({ error: "Failed to clone quiz" });
    } finally {
        client.release();
    }

    try {
        const quiz = await getAdminQuizDetail(createdQuizId);
        return res.status(201).json({ quiz });
    } catch (error) {
        console.error("Admin quiz clone follow-up load failed:", error);
        return res.status(201).json({ quiz: null });
    }
});

app.delete("/api/admin/quizzes/:quizId", async (req, res) => {
    const quizId = parsePositiveIntParam(req.params.quizId);
    if (!quizId) return res.status(400).json({ error: "Invalid quiz id" });

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        const quiz = await requireQuizRow(client, quizId);
        if (quiz.status !== QUIZ_STATUS_DRAFT) {
            throw createHttpError(409, "Only unused draft quizzes can be deleted. Archive published quizzes instead.");
        }

        const attemptResult = await client.query(
            `SELECT COUNT(*)::INT AS attempt_count
             FROM quiz_attempts
             WHERE quiz_id = $1`,
            [quizId]
        );
        const attemptCount = Number(attemptResult.rows[0]?.attempt_count) || 0;
        if (attemptCount > 0) {
            throw createHttpError(409, "Used quizzes cannot be deleted. Archive the quiz instead.");
        }

        await client.query(`DELETE FROM quizzes WHERE quiz_id = $1`, [quizId]);

        await client.query("COMMIT");
        committed = true;
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during admin quiz delete:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Admin quiz delete endpoint failed:", error);
        return res.status(500).json({ error: "Failed to delete quiz" });
    } finally {
        client.release();
    }

    return res.json({ removed: true });
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
    if (typeof rawTitle !== "string") return res.status(400).json({ error: "Title is required" });

    const title = rawTitle.trim();
    if (!title) return res.status(400).json({ error: "Title cannot be empty" });
    if (title.length > MODULE_TITLE_MAX_LENGTH) return res.status(400).json({ error: `Title must be at most ${MODULE_TITLE_MAX_LENGTH} characters` });

    const description = req.body?.description ?? null; // NEW

    try {
        const updateResult = await pool.query(
            `UPDATE modules
             SET title = $2, description = $3
             WHERE module_id = $1
             RETURNING module_id, module_code`,
            [moduleId, title, description] // UPDATED
        );

        if (updateResult.rowCount === 0) return res.status(404).json({ error: "Module not found" });

        const moduleCode = updateResult.rows[0].module_code;
        await logAdminAction(pool, req.user?.account_id || req.auth?.account_id || null, 'admin_module_edited', null, `Updated module details for Module ${moduleCode}`, { module_id: moduleId });

        invalidateAdminCaches();
        const [item] = await getAdminLessonItems(moduleId);
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

        await logAdminAction(client, req.user?.account_id || null, 'admin_lesson_added', null, `Added a new lesson "${title}" to Module ${moduleId}`, { module_id: moduleId, resource_id: createdResourceId });

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

        await logAdminAction(client, req.user?.account_id || null, 'admin_lesson_edited', null, `Edited lesson details for Resource ${resourceId} in Module ${moduleId}`, { module_id: moduleId, resource_id: resourceId });

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
            
            // Use the dual-route storage function here
            await storeLessonPdf(newStorageKey, req.file.buffer, mimeType || "application/pdf");

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

// The legacy bulk upload route (retained for fallback)
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
            
            // Use the dual-route storage function here
            await storeLessonPdf(newStorageKey, req.file.buffer, mimeType || "application/pdf");

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
                   SELECT
                     t.trainee_id,
                     COALESCE(a.access_mode, '${ACCOUNT_ACCESS_MODE_STANDARD}') AS access_mode
                   FROM trainees t
                   JOIN accounts a ON a.trainee_id = t.trainee_id
                   JOIN batches b ON b.batch_id = t.batch_id
                   WHERE ($1::TEXT IS NULL OR b.batch_code = $1)
                 ),
                 scoped_standard_trainees AS (
                   SELECT trainee_id
                   FROM scoped_trainees
                   WHERE access_mode <> '${ACCOUNT_ACCESS_MODE_LESSON_ONLY}'
                 ),
                 scoped_module_rows AS (
                   SELECT
                     v.module_status
                   FROM v_trainee_module_status v
                   JOIN scoped_standard_trainees st ON st.trainee_id = v.trainee_id
                 ),
                 summary_stats AS (
                   SELECT
                     COALESCE((SELECT COUNT(*)::INT FROM scoped_trainees), 0)::INT AS total_trainees,
                     COALESCE(
                       (
                         SELECT COUNT(*) FILTER (WHERE access_mode <> '${ACCOUNT_ACCESS_MODE_LESSON_ONLY}')::INT
                         FROM scoped_trainees
                       ),
                       0
                     )::INT AS standard_trainees,
                     COALESCE(
                       (
                         SELECT COUNT(*) FILTER (WHERE access_mode = '${ACCOUNT_ACCESS_MODE_LESSON_ONLY}')::INT
                         FROM scoped_trainees
                       ),
                       0
                     )::INT AS lesson_only_trainees,
                     COALESCE((SELECT COUNT(*)::INT FROM modules), 0)::INT AS total_modules,
                     COALESCE(
                       (
                         SELECT COUNT(*) FILTER (
                           WHERE module_status = 'COMPLETED'
                         )::INT
                         FROM scoped_module_rows
                       ),
                       0
                     )::INT AS completed_module_rows,
                     COALESCE((SELECT COUNT(*)::INT FROM scoped_module_rows), 0)::INT AS total_module_rows
                 )
                 SELECT
                   summary_stats.total_trainees,
                   summary_stats.standard_trainees,
                   summary_stats.lesson_only_trainees,
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
                   SELECT
                     t.trainee_id,
                     COALESCE(a.access_mode, '${ACCOUNT_ACCESS_MODE_STANDARD}') AS access_mode
                   FROM trainees t
                   JOIN accounts a ON a.trainee_id = t.trainee_id
                   JOIN batches b ON b.batch_id = t.batch_id
                   WHERE ($1::TEXT IS NULL OR b.batch_code = $1)
                 ),
                 scoped_standard_trainees AS (
                   SELECT trainee_id
                   FROM scoped_trainees
                   WHERE access_mode <> '${ACCOUNT_ACCESS_MODE_LESSON_ONLY}'
                 ),
                 module_completion AS (
                   SELECT
                     v.module_id,
                     COUNT(*)::INT AS total_trainees,
                     COUNT(*) FILTER (
                       WHERE v.module_status = 'COMPLETED'
                     )::INT AS completed_trainees
                   FROM v_trainee_module_status v
                   JOIN scoped_standard_trainees st ON st.trainee_id = v.trainee_id
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
                    standard_trainees: Number(summaryRow.standard_trainees) || 0,
                    lesson_only_trainees: Number(summaryRow.lesson_only_trainees) || 0,
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

        const item = result.rows[0];
        
        await logAdminAction(pool, req.user?.account_id || null, 'admin_batch_created', batchCode, `Added new batch ${batchCode}`);
        
        return res.status(201).json({ item });
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
               a.access_mode,
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
                "access_mode",
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
                    item.access_mode,
                    item.status,
                    item.access_mode === ACCOUNT_ACCESS_MODE_LESSON_ONLY ? "" : item.progress.percent,
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
            `${ADMIN_MODULE_STATUS_QUIZ_CTES}
             SELECT
               b.batch_code,
               t.trainee_code,
               t.first_name,
               t.middle_name,
               t.last_name,
               a.access_mode,
               module_status.module_code,
               module_status.module_title,
               module_status.module_status,
               module_status.required_sims,
               module_status.completed_required_sims,
               COALESCE(module_quiz.quiz_required, FALSE) AS quiz_required,
               COALESCE(quiz_progress.quiz_passed, FALSE) AS quiz_passed
             FROM trainees t
             JOIN batches b ON b.batch_id = t.batch_id
             JOIN accounts a ON a.trainee_id = t.trainee_id
             JOIN v_trainee_module_status module_status ON module_status.trainee_id = t.trainee_id
             LEFT JOIN module_quiz_requirements module_quiz
               ON module_quiz.module_id = module_status.module_id
             LEFT JOIN trainee_module_quiz_progress quiz_progress
               ON quiz_progress.trainee_id = module_status.trainee_id
              AND quiz_progress.module_id = module_status.module_id
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
                "access_mode",
                "module_code",
                "module_title",
                "module_status",
                "required_sims",
                "completed_required_sims",
                "quiz_required",
                "quiz_passed",
            ]),
        ];

        for (const row of result.rows) {
            lines.push(
                buildCsvRow([
                    row.batch_code,
                    row.trainee_code,
                    buildTraineeFullName(row),
                    normalizeAccountAccessMode(row.access_mode) || ACCOUNT_ACCESS_MODE_STANDARD,
                    row.module_code,
                    row.module_title,
                    getAdminModuleReportingStatus(row.access_mode, row.module_status),
                    row.required_sims,
                    row.completed_required_sims,
                    row.quiz_required === true ? "true" : "false",
                    row.quiz_passed === true ? "true" : "false",
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
        const hasAccessModeColumn = parsedCsv.has_access_mode_column === true;
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
                const accessModeResult = parseCsvImportAccessMode(row.access_mode, hasAccessModeColumn);
                if (accessModeResult.error) {
                    summary.skipped += 1;
                    summary.errors += 1;
                    row_errors.push({
                        row: row.row,
                        email: normalizedEmail,
                        error: accessModeResult.error,
                    });
                    continue;
                }

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

                    const accountUpdate = accessModeResult.should_update_existing
                        ? await client.query(
                              `UPDATE accounts
                               SET login_email = $2,
                                   access_mode = $3
                               WHERE trainee_id = $1
                               RETURNING trainee_id`,
                              [existing.trainee_id, normalizedEmail, accessModeResult.access_mode]
                          )
                        : await client.query(
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
                        access_mode: accessModeResult.access_mode,
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
           a.access_mode,
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

        const rows = await getAdminModuleStatusRowsForTrainee(traineeId);
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
         SET login_email = $2,
             access_mode = $3
         WHERE trainee_id = $1
         RETURNING trainee_id`,
            [traineeId, payload.email, payload.access_mode]
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
        const account = await getLiveAuthAccountOrRespond(req, res);
        if (!account) return;

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
        const storageKey = row.storage_key;
        const downloadName = sanitizePdfOriginalFilename(row.original_filename || `module-${resourceId}.pdf`);

        if (supabase) {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storageKey);
            if (error) {
                console.error("Supabase download error:", error);
                return res.status(404).json({ error: "PDF file not found in storage." });
            }
            
            const buffer = Buffer.from(await data.arrayBuffer());
            res.setHeader("Content-Type", row.mime_type || "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(downloadName)}"`);
            res.setHeader("Content-Length", String(buffer.length));
            res.setHeader("X-Content-Type-Options", "nosniff");
            return res.send(buffer);
        } else {
            const storagePath = resolveLessonPdfStoragePath(storageKey);
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
        }
    } catch (error) {
        console.error("PDF read endpoint failed:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/me/modules/:moduleId/quiz", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client);
        if (!quiz) {
            await client.query("COMMIT");
            committed = true;
            return res.json({ quiz: null });
        }

        let currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });

        const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
            traineeId: account.trainee_id,
        });
        currentAttempt = expiration.attempt;

        if (currentAttempt) {
            throw createHttpError(409, "Quiz attempt is still in progress");
        }

        const latestResult =
            expiration.finalized?.attempt ||
            (await getLatestFinalQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id));
        const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

        await client.query("COMMIT");
        committed = true;
        if (expiration.finalized) {
            invalidateAdminCaches();
        }

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                currentAttempt,
                latestResult,
                attemptsUsed,
            }),
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz summary:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz summary endpoint failed:", error);
        return res.status(500).json({ error: "Failed to load quiz summary" });
    } finally {
        client.release();
    }
});

app.post("/api/me/modules/:moduleId/quiz/attempt", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client, { lock: true });
        if (!quiz) {
            throw createHttpError(404, "No published quiz available for this module");
        }

        const currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });
        const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
            traineeId: account.trainee_id,
        });

        const { attempt, created } = await getOrCreateInProgressQuizAttempt(client, quiz.quiz_id, account.trainee_id);
        const [questions, savedAnswers, attemptsUsed] = await Promise.all([
            getTraineeQuizQuestions(quiz.quiz_id, client),
            getQuizAttemptSavedAnswers(client, attempt.attempt_id),
            getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id),
        ]);

        await client.query("COMMIT");
        committed = true;
        if (expiration.finalized) {
            invalidateAdminCaches();
        }

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                currentAttempt: attempt,
                attemptsUsed,
            }),
            attempt: buildTraineeQuizAttemptPayload(attempt),
            questions,
            saved_answers: savedAnswers,
            created,
            resumed: created !== true,
            expired: false,
            result: null,
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz start/resume:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz start/resume endpoint failed:", error);
        return res.status(500).json({ error: "Failed to start quiz attempt" });
    } finally {
        client.release();
    }
});

app.get("/api/me/modules/:moduleId/quiz/attempt", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client, { lock: true });
        if (!quiz) {
            throw createHttpError(404, "No published quiz available for this module");
        }

        const currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });
        if (!currentAttempt) {
            throw createHttpError(404, "No in-progress quiz attempt");
        }

        const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
            traineeId: account.trainee_id,
        });
        if (expiration.finalized) {
            const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

            await client.query("COMMIT");
            committed = true;
            invalidateAdminCaches();

            return res.json({
                quiz: buildTraineeQuizSummaryPayload(quiz, {
                    latestResult: expiration.finalized.attempt,
                    attemptsUsed,
                }),
                attempt: null,
                questions: [],
                saved_answers: [],
                expired: true,
                result: buildTraineeQuizResultPayload(expiration.finalized.attempt),
            });
        }

        const [questions, savedAnswers, attemptsUsed] = await Promise.all([
            getTraineeQuizQuestions(quiz.quiz_id, client),
            getQuizAttemptSavedAnswers(client, currentAttempt.attempt_id),
            getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id),
        ]);

        await client.query("COMMIT");
        committed = true;

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                currentAttempt,
                attemptsUsed,
            }),
            attempt: buildTraineeQuizAttemptPayload(currentAttempt),
            questions,
            saved_answers: savedAnswers,
            expired: false,
            result: null,
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz attempt fetch:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz attempt fetch endpoint failed:", error);
        return res.status(500).json({ error: "Failed to load quiz attempt" });
    } finally {
        client.release();
    }
});

app.put("/api/me/modules/:moduleId/quiz/answers/:questionId", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    const questionId = parsePositiveIntParam(req.params.questionId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });
    if (!questionId) return res.status(400).json({ error: "Invalid question id" });

    const selectedChoiceId = parsePositiveIntParam(req.body?.selected_choice_id);
    if (!selectedChoiceId) {
        return res.status(400).json({ error: "A valid selected_choice_id is required" });
    }

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client, { lock: true });
        if (!quiz) {
            throw createHttpError(404, "No published quiz available for this module");
        }

        const currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });
        if (!currentAttempt) {
            throw createHttpError(409, "No in-progress quiz attempt");
        }

        const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
            traineeId: account.trainee_id,
        });
        if (expiration.finalized) {
            const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

            await client.query("COMMIT");
            committed = true;
            invalidateAdminCaches();

            return res.json({
                quiz: buildTraineeQuizSummaryPayload(quiz, {
                    latestResult: expiration.finalized.attempt,
                    attemptsUsed,
                }),
                attempt: null,
                saved_answer: null,
                expired: true,
                result: buildTraineeQuizResultPayload(expiration.finalized.attempt),
            });
        }

        const savedAnswer = await saveQuizAttemptAnswer(
            client,
            currentAttempt.attempt_id,
            questionId,
            selectedChoiceId,
            { traineeId: account.trainee_id }
        );
        const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

        await client.query("COMMIT");
        committed = true;

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                currentAttempt,
                attemptsUsed,
            }),
            attempt: buildTraineeQuizAttemptPayload(currentAttempt),
            saved_answer: savedAnswer,
            expired: false,
            result: null,
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz answer save:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz answer save endpoint failed:", error);
        return res.status(500).json({ error: "Failed to save quiz answer" });
    } finally {
        client.release();
    }
});

app.post("/api/me/modules/:moduleId/quiz/submit", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client, { lock: true });
        if (!quiz) {
            throw createHttpError(404, "No published quiz available for this module");
        }

        const currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });

        let finalizedAttempt = null;
        let expired = false;
        let didFinalizeAttempt = false;

        if (currentAttempt) {
            const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
                traineeId: account.trainee_id,
            });

            if (expiration.finalized) {
                finalizedAttempt = expiration.finalized.attempt;
                expired = true;
                didFinalizeAttempt = true;
            } else {
                const submission = await finalizeQuizAttempt(client, currentAttempt.attempt_id, {
                    traineeId: account.trainee_id,
                    status: QUIZ_ATTEMPT_STATUS_SUBMITTED,
                });
                finalizedAttempt = submission.attempt;
                didFinalizeAttempt = true;
            }
        } else {
            finalizedAttempt = await getLatestFinalQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);
        }

        if (!finalizedAttempt) {
            throw createHttpError(409, "No in-progress quiz attempt");
        }

        const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

        await client.query("COMMIT");
        committed = true;
        if (didFinalizeAttempt) {
            invalidateAdminCaches();
        }

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                latestResult: finalizedAttempt,
                attemptsUsed,
            }),
            result: buildTraineeQuizResultPayload(finalizedAttempt),
            expired,
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz submit:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz submit endpoint failed:", error);
        return res.status(500).json({ error: "Failed to submit quiz attempt" });
    } finally {
        client.release();
    }
});

app.get("/api/me/modules/:moduleId/quiz/result", requireAuth, async (req, res) => {
    const moduleId = parsePositiveIntParam(req.params.moduleId);
    if (!moduleId) return res.status(400).json({ error: "Invalid module id" });

    const account = await requireLiveTraineeAccess(req, res);
    if (!account) return;

    const client = await pool.connect();
    let committed = false;

    try {
        await client.query("BEGIN");
        await requireModuleExists(client, moduleId);

        const quiz = await getPublishedTraineeQuizSummaryForModule(moduleId, client, { lock: true });
        if (!quiz) {
            throw createHttpError(404, "No published quiz available for this module");
        }

        let currentAttempt = await getQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id, {
            status: QUIZ_ATTEMPT_STATUS_IN_PROGRESS,
            lock: true,
        });
        const expiration = await finalizeExpiredQuizAttemptIfNeeded(client, currentAttempt, {
            traineeId: account.trainee_id,
        });
        currentAttempt = expiration.attempt;

        const latestResult =
            expiration.finalized?.attempt ||
            (await getLatestFinalQuizAttemptByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id));
        if (!latestResult) {
            throw createHttpError(404, "No quiz result available");
        }

        const attemptsUsed = await getQuizAttemptCountByQuizAndTrainee(client, quiz.quiz_id, account.trainee_id);

        await client.query("COMMIT");
        committed = true;
        if (expiration.finalized) {
            invalidateAdminCaches();
        }

        return res.json({
            quiz: buildTraineeQuizSummaryPayload(quiz, {
                currentAttempt,
                latestResult,
                attemptsUsed,
            }),
            result: buildTraineeQuizResultPayload(latestResult),
        });
    } catch (error) {
        if (!committed) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback failed during trainee quiz result fetch:", rollbackError);
            }
        }

        if (error?.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        if (isMissingQuizSchemaError(error)) {
            return res.status(503).json({ error: getQuizSchemaApplyMessage() });
        }

        console.error("Trainee quiz result endpoint failed:", error);
        return res.status(500).json({ error: "Failed to load quiz result" });
    } finally {
        client.release();
    }
});

// Modules + resources + simulations
app.get("/api/modules", requireAuth, async (req, res) => {
    try {
        const account = await getLiveAuthAccountOrRespond(req, res);
        if (!account) return;

        const curriculum = await getCurriculumContent({
            includeSimulations: canAccessSimulationFeatures(account.access_mode),
        });
        res.json(curriculum);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Computed module status for a trainee (Option A view)
app.get("/api/trainees/:traineeId/module-status", requireAuth, async (req, res) => {
    try {
        const traineeId = parsePositiveIntParam(req.params.traineeId);
        if (!traineeId) return res.status(400).json({ error: "Invalid traineeId" });
        const account = await requireLiveTraineeAccess(req, res, traineeId);
        if (!account) return;

        const rows = await getModuleStatusRowsForTrainee(traineeId);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/me/module-status", requireAuth, async (req, res) => {
    try {
        const account = await requireLiveTraineeAccess(req, res);
        if (!account) return;

        const rows = await getModuleStatusRowsForTrainee(account.trainee_id);
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
        const account = await requireLiveTraineeAccess(req, res, traineeId);
        if (!account) return;

        const payload = await getDashboardPayloadForTrainee(traineeId);
        if (!payload) return res.status(404).json({ error: "Trainee not found" });

        res.json(payload);
    } catch (e) {
        console.error("Dashboard endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/curriculum/public", async (req, res) => {
    try {
        const curriculum = await getCurriculumContent({
            includeSimulations: shouldIncludeDeveloperCurriculumSimulations(req),
        });
        res.json(curriculum);
    } catch (e) {
        console.error("Public curriculum endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/me/dashboard", requireAuth, async (req, res) => {
    try {
        const account = await requireLiveTraineeAccess(req, res);
        if (!account) return;

        const payload = await getDashboardPayloadForTrainee(account.trainee_id);
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
        const account = await requireLiveTraineeAccess(req, res, traineeId);
        if (!account) return;
        if (!canAccessSimulationFeatures(account.access_mode)) {
            return respondLessonOnlySimulationDenied(res);
        }

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
        const account = await requireLiveTraineeAccess(req, res);
        if (!account) return;
        if (!canAccessSimulationFeatures(account.access_mode)) {
            return respondLessonOnlySimulationDenied(res);
        }

        const simulationId = parsePositiveIntParam(req.params.simulationId);
        if (!simulationId) return res.status(400).json({ error: "Invalid simulationId" });

        const rawBestScore = req.body?.bestScore;
        let bestScore = null;

        if (rawBestScore !== undefined && rawBestScore !== null) {
            const isValidScore = typeof rawBestScore === "number" && Number.isFinite(rawBestScore) && rawBestScore >= 0;
            if (!isValidScore) return res.status(400).json({ error: "Invalid bestScore" });
            bestScore = rawBestScore;
        }

        const completionResult = await completeSimulationForTrainee(account.trainee_id, simulationId, bestScore);
        if (completionResult.error) return res.status(completionResult.status).json({ error: completionResult.error });

        res.json({ ok: true });
    } catch (e) {
        console.error("Simulation completion endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => console.log(`✅ API running on port ${PORT}`));
