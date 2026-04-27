#!/usr/bin/env node
"use strict";

// Usage:
// BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@demo.local ADMIN_PASSWORD=P@ssw0rd! node scripts/admin-smoke.js

if (typeof fetch !== "function") {
    console.error("FAIL Node runtime does not provide fetch(). Use Node 18+.");
    process.exit(1);
}

const BASE_URL = (process.env.BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "P@ssw0rd!";

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

    // 5) Lesson PATCH should accept VIDEO type/url updates without title or order_no
    try {
        const { response: lessonsResponse, data: lessonsData } = await requestJson("/api/admin/lessons", {
            headers: authHeaders,
        });
        const items = Array.isArray(lessonsData?.items) ? lessonsData.items : [];
        const moduleId = Number(items[0]?.module_id);

        if (lessonsResponse.status !== 200) {
            fail(`GET /api/admin/lessons expected 200, got ${lessonsResponse.status}`);
        } else if (!Number.isInteger(moduleId) || moduleId < 1) {
            fail("GET /api/admin/lessons did not return a usable module for lesson smoke test");
        } else {
            const lessonTitle = `Smoke Video Update ${Date.now()}`;
            const youTubeVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
            let createdResourceId = null;

            try {
                const { response: createResponse, data: createData } = await requestJson(
                    `/api/admin/modules/${moduleId}/lessons`,
                    {
                        method: "POST",
                        headers: {
                            ...authHeaders,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            title: lessonTitle,
                            type: "PDF",
                        }),
                    }
                );

                createdResourceId = Number(createData?.lesson?.resource_id);
                if (createResponse.status !== 201 || !Number.isInteger(createdResourceId) || createdResourceId < 1) {
                    fail(`POST /api/admin/modules/${moduleId}/lessons failed for lesson smoke test (status=${createResponse.status})`);
                } else {
                    const { response: patchResponse, data: patchData } = await requestJson(
                        `/api/admin/modules/${moduleId}/lessons/${createdResourceId}`,
                        {
                            method: "PATCH",
                            headers: {
                                ...authHeaders,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                type: "VIDEO",
                                video_url: youTubeVideoUrl,
                            }),
                        }
                    );

                    const patchedLesson = patchData?.lesson;
                    if (patchResponse.status !== 200) {
                        fail(
                            `PATCH /api/admin/modules/${moduleId}/lessons/${createdResourceId} expected 200 for VIDEO update, got ${patchResponse.status}`,
                        );
                    } else if (patchedLesson?.type !== "VIDEO") {
                        fail("Lesson VIDEO update smoke test returned 200 but did not persist type=VIDEO");
                    } else if (patchedLesson?.url !== youTubeVideoUrl && patchedLesson?.resolved_url !== youTubeVideoUrl) {
                        fail("Lesson VIDEO update smoke test returned 200 but did not persist the video URL");
                    } else {
                        pass("PATCH /api/admin/modules/:moduleId/lessons/:resourceId accepts VIDEO type/url-only updates");
                    }
                }
            } finally {
                if (Number.isInteger(createdResourceId) && createdResourceId > 0) {
                    const { response: deleteResponse } = await requestJson(
                        `/api/admin/modules/${moduleId}/lessons/${createdResourceId}`,
                        {
                            method: "DELETE",
                            headers: authHeaders,
                        }
                    );
                    if (deleteResponse.status !== 200) {
                        fail(
                            `DELETE /api/admin/modules/${moduleId}/lessons/${createdResourceId} cleanup expected 200, got ${deleteResponse.status}`,
                        );
                    }
                }
            }
        }
    } catch (error) {
        fail(
            `Lesson VIDEO update smoke test request error: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    // 6) Google Drive preview/view URLs should be accepted, canonicalized, and unsupported Drive URLs rejected
    try {
        const { response: lessonsResponse, data: lessonsData } = await requestJson("/api/admin/lessons", {
            headers: authHeaders,
        });
        const items = Array.isArray(lessonsData?.items) ? lessonsData.items : [];
        const moduleId = Number(items[0]?.module_id);

        if (lessonsResponse.status !== 200) {
            fail(`GET /api/admin/lessons expected 200, got ${lessonsResponse.status}`);
        } else if (!Number.isInteger(moduleId) || moduleId < 1) {
            fail("GET /api/admin/lessons did not return a usable module for Google Drive video smoke test");
        } else {
            const googleDrivePreviewUrl =
                "https://drive.google.com/file/d/1BXtg_jjJJuoi38vYnk-KicLgrhu4EL5Q/preview";
            const googleDrivePreviewUrlWithQuery =
                "https://drive.google.com/file/d/1BXtg_jjJJuoi38vYnk-KicLgrhu4EL5Q/preview?usp=sharing";
            const googleDriveViewUrl =
                "https://drive.google.com/file/d/1BXtg_jjJJuoi38vYnk-KicLgrhu4EL5Q/view?usp=sharing";
            const unsupportedGoogleDriveUrl =
                "https://drive.google.com/file/d/1BXtg_jjJJuoi38vYnk-KicLgrhu4EL5Q/edit?usp=sharing";
            const lessonTitle = `Smoke Drive Video ${Date.now()}`;
            let createdResourceId = null;

            try {
                const { response: createResponse, data: createData } = await requestJson(
                    `/api/admin/modules/${moduleId}/lessons`,
                    {
                        method: "POST",
                        headers: {
                            ...authHeaders,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            title: lessonTitle,
                            type: "VIDEO",
                            url: googleDrivePreviewUrlWithQuery,
                        }),
                    }
                );

                createdResourceId = Number(createData?.lesson?.resource_id);
                const createdLesson = createData?.lesson;
                if (createResponse.status !== 201 || !Number.isInteger(createdResourceId) || createdResourceId < 1) {
                    fail(
                        `POST /api/admin/modules/${moduleId}/lessons expected 201 for Google Drive preview URL, got ${createResponse.status}`,
                    );
                } else if (createdLesson?.type !== "VIDEO") {
                    fail("Google Drive video create smoke test returned 201 but did not persist type=VIDEO");
                } else if (
                    createdLesson?.url !== googleDrivePreviewUrl &&
                    createdLesson?.resolved_url !== googleDrivePreviewUrl
                ) {
                    fail("Google Drive video create smoke test did not persist the canonical preview URL");
                } else {
                    pass("POST /api/admin/modules/:moduleId/lessons accepts Google Drive preview URLs for VIDEO lessons");
                }

                if (Number.isInteger(createdResourceId) && createdResourceId > 0) {
                    const { response: viewPatchResponse, data: viewPatchData } = await requestJson(
                        `/api/admin/modules/${moduleId}/lessons/${createdResourceId}`,
                        {
                            method: "PATCH",
                            headers: {
                                ...authHeaders,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                type: "VIDEO",
                                video_url: googleDriveViewUrl,
                            }),
                        }
                    );

                    const viewPatchedLesson = viewPatchData?.lesson;
                    if (viewPatchResponse.status !== 200) {
                        fail(
                            `PATCH /api/admin/modules/${moduleId}/lessons/${createdResourceId} expected 200 for Google Drive /view URL, got ${viewPatchResponse.status}`,
                        );
                    } else if (
                        viewPatchedLesson?.url !== googleDrivePreviewUrl &&
                        viewPatchedLesson?.resolved_url !== googleDrivePreviewUrl
                    ) {
                        fail(
                            "Google Drive /view smoke test did not normalize the saved URL to the canonical preview URL",
                        );
                    } else {
                        pass("PATCH /api/admin/modules/:moduleId/lessons/:resourceId accepts Google Drive /view URLs and normalizes them");
                    }

                    const { response: invalidPatchResponse, data: invalidPatchData } = await requestJson(
                        `/api/admin/modules/${moduleId}/lessons/${createdResourceId}`,
                        {
                            method: "PATCH",
                            headers: {
                                ...authHeaders,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                type: "VIDEO",
                                video_url: unsupportedGoogleDriveUrl,
                            }),
                        }
                    );

                    const errorMessage = invalidPatchData && typeof invalidPatchData.error === "string"
                        ? invalidPatchData.error
                        : "";
                    if (invalidPatchResponse.status !== 400) {
                        fail(
                            `PATCH /api/admin/modules/${moduleId}/lessons/${createdResourceId} expected 400 for unsupported Google Drive URL, got ${invalidPatchResponse.status}`,
                        );
                    } else if (!errorMessage.includes("Google Drive /preview or /view")) {
                        fail(
                            `Unsupported Google Drive URL returned 400 but unexpected error message: "${errorMessage}"`,
                        );
                    } else {
                        pass("PATCH /api/admin/modules/:moduleId/lessons/:resourceId rejects unsupported Google Drive VIDEO URLs");
                    }
                }
            } finally {
                if (Number.isInteger(createdResourceId) && createdResourceId > 0) {
                    const { response: deleteResponse } = await requestJson(
                        `/api/admin/modules/${moduleId}/lessons/${createdResourceId}`,
                        {
                            method: "DELETE",
                            headers: authHeaders,
                        }
                    );
                    if (deleteResponse.status !== 200) {
                        fail(
                            `DELETE /api/admin/modules/${moduleId}/lessons/${createdResourceId} cleanup expected 200, got ${deleteResponse.status}`,
                        );
                    }
                }
            }
        }
    } catch (error) {
        fail(
            `Google Drive video smoke test request error: ${error instanceof Error ? error.message : String(error)}`,
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
