#!/usr/bin/env node
"use strict";

// Usage:
// BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@demo.local ADMIN_PASSWORD=Admin@12345! node scripts/admin-smoke.js

if (typeof fetch !== "function") {
    console.error("FAIL Node runtime does not provide fetch(). Use Node 18+.");
    process.exit(1);
}

const BASE_URL = (process.env.BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345!";

const state = {
    failed: false,
    token: null,
};

function pass(message) {
    console.log(`PASS ${message}`);
}

function fail(message) {
    state.failed = true;
    console.error(`FAIL ${message}`);
}

async function requestJson(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, options);
    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    return { response, data };
}

async function run() {
    console.log(`Running admin smoke checks against ${BASE_URL}`);

    // 1) Login
    try {
        const { response, data } = await requestJson("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
        });

        if (response.status !== 200 || !data || typeof data.token !== "string" || data.token.length === 0) {
            fail(`Login failed (status=${response.status})`);
            return;
        }

        state.token = data.token;
        pass("POST /api/auth/login returned token");
    } catch (error) {
        fail(`Login request error: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    const authHeaders = { Authorization: `Bearer ${state.token}` };

    // 2) Dashboard 200
    try {
        const { response } = await requestJson("/api/admin/dashboard", { headers: authHeaders });
        const cacheHeader = response.headers.get("x-cache");
        if (response.status !== 200) {
            fail(`GET /api/admin/dashboard expected 200, got ${response.status}`);
        } else {
            pass(`GET /api/admin/dashboard -> 200${cacheHeader ? ` (X-Cache=${cacheHeader})` : ""}`);
        }
    } catch (error) {
        fail(`GET /api/admin/dashboard request error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 3) Activity logs 200
    try {
        const { response } = await requestJson("/api/admin/activity-logs?limit=5", { headers: authHeaders });
        const cacheHeader = response.headers.get("x-cache");
        if (response.status !== 200) {
            fail(`GET /api/admin/activity-logs?limit=5 expected 200, got ${response.status}`);
        } else {
            pass(`GET /api/admin/activity-logs?limit=5 -> 200${cacheHeader ? ` (X-Cache=${cacheHeader})` : ""}`);
        }
    } catch (error) {
        fail(
            `GET /api/admin/activity-logs?limit=5 request error: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    // 4) Invalid batch_code should return 400 + message
    try {
        const { response, data } = await requestJson("/api/admin/activity-logs?batch_code=BAD-CODE", {
            headers: authHeaders,
        });
        const errorMessage = data && typeof data.error === "string" ? data.error : "";
        if (response.status !== 400) {
            fail(`GET /api/admin/activity-logs?batch_code=BAD-CODE expected 400, got ${response.status}`);
        } else if (!errorMessage.includes("Invalid batch_code format")) {
            fail(
                `GET /api/admin/activity-logs?batch_code=BAD-CODE returned 400 but unexpected error message: "${errorMessage}"`,
            );
        } else {
            pass("GET /api/admin/activity-logs?batch_code=BAD-CODE -> 400 with expected error");
        }
    } catch (error) {
        fail(
            `GET /api/admin/activity-logs?batch_code=BAD-CODE request error: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}

run()
    .then(() => {
        process.exit(state.failed ? 1 : 0);
    })
    .catch((error) => {
        console.error(`FAIL Unexpected script error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    });
