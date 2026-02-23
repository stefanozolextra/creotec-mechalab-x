require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Put it in server/.env");
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN?.trim() || "8h";
const DEFAULT_TRAINEE_PASSWORD = process.env.DEFAULT_TRAINEE_PASSWORD?.trim() || "";

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

function getRoleForEmail(email) {
    return ADMIN_EMAILS.has(normalizeEmail(email)) ? "admin" : "student";
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

        const { sub, role, account_id } = decoded;
        if (!sub || !account_id || (role !== "admin" && role !== "student")) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.auth = { sub, role, account_id };
        next();
    } catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

function requireAdmin(req, res, next) {
    if (req.auth?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
    }
    next();
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

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function sanitizeOptionalString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function validateEmailFormat(value) {
    return typeof value === "string" && value.includes("@") && value.includes(".");
}

function validateDateYYYYMMDD(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    if (!isNonEmptyString(body.batch_code)) return { error: "batch_code is required" };

    const email = normalizeEmail(body.email);
    if (!validateEmailFormat(email)) return { error: "Invalid email format" };

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
            batch_code: body.batch_code.trim(),
        },
    };
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
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || typeof password !== "string" || password.length === 0) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const result = await pool.query(
            `SELECT account_id, trainee_id, login_email, password_hash, is_active
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

        const role = getRoleForEmail(account.login_email);
        const payload = {
            sub: account.trainee_id,
            role,
            account_id: account.account_id,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({
            token,
            role,
            sub: account.trainee_id,
            account_id: account.account_id,
        });
    } catch (e) {
        console.error("Login endpoint failed:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.use("/api/admin", requireAuth, requireAdmin);

app.get("/api/admin/auth-check", (req, res) => {
    res.json({
        ok: true,
        role: req.auth.role,
        sub: req.auth.sub,
        account_id: req.auth.account_id,
    });
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

app.post("/api/admin/trainees", async (req, res) => {
    const parsedPayload = parseAdminTraineePayload(req.body);
    if (parsedPayload.error) return res.status(400).json({ error: parsedPayload.error });

    if (!DEFAULT_TRAINEE_PASSWORD) {
        return res.status(500).json({ error: "DEFAULT_TRAINEE_PASSWORD is not configured" });
    }

    const payload = parsedPayload.value;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const batchResult = await client.query(
            `SELECT batch_id, batch_code
         FROM batches
         WHERE batch_code = $1`,
            [payload.batch_code]
        );
        if (batchResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Batch not found" });
        }

        const batch = batchResult.rows[0];

        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [batch.batch_code]);

        const codePattern = `${batch.batch_code}-%`;
        const seqResult = await client.query(
            `SELECT
           COALESCE(MAX((substring(trainee_code FROM '([0-9]+)$'))::INT), 0) AS max_suffix
         FROM trainees
         WHERE trainee_code LIKE $1`,
            [codePattern]
        );

        const nextSeq = (Number(seqResult.rows[0]?.max_suffix) || 0) + 1;
        const traineeCode = `${batch.batch_code}-${String(nextSeq).padStart(4, "0")}`;

        const traineeInsert = await client.query(
            `INSERT INTO trainees
          (batch_id, trainee_code, first_name, middle_name, last_name, email, contact_number, address, birth_date)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING trainee_id`,
            [
                batch.batch_id,
                traineeCode,
                payload.first_name,
                payload.middle_name,
                payload.last_name,
                payload.email,
                payload.contact_number,
                payload.address,
                payload.birth_date,
            ]
        );

        const traineeId = traineeInsert.rows[0].trainee_id;
        const passwordHash = await bcrypt.hash(DEFAULT_TRAINEE_PASSWORD, 10);

        await client.query(
            `INSERT INTO accounts
          (trainee_id, login_email, password_hash, is_active)
         VALUES
          ($1, $2, $3, TRUE)`,
            [traineeId, payload.email, passwordHash]
        );

        const item = await fetchAdminTraineeById(client, traineeId);
        if (!item) {
            await client.query("ROLLBACK");
            return res.status(500).json({ error: "Failed to load trainee after creation" });
        }

        await client.query("COMMIT");
        res.status(201).json({ item });
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

        const batchResult = await client.query(
            `SELECT batch_id, batch_code
         FROM batches
         WHERE batch_code = $1`,
            [payload.batch_code]
        );
        if (batchResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Batch not found" });
        }

        const batch = batchResult.rows[0];

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

app.post("/api/admin/trainees/:id/reset-pin", async (req, res) => {
    res.status(501).json({ error: "PIN reset is not enabled in this deployment." });
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
