import { requestJson } from "./http";
import type { DashboardResponseApi } from "../types/traineeDashboard";
import { getAuthRole } from "../utils/auth";

const toPositiveInt = (value: number, label: string): number => {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid ${label}.`);
    }
    return value;
};

// 🌟 THE OFFLINE GOD MODE CURRICULUM 🌟
const OFFLINE_DUMMY_DASHBOARD = {
    trainee: {
        trainee_id: 999999, account_id: 999999, first_name: "God Mode", last_name: "Developer",
        trainee_code: "DEV-OVERRIDE", batch_id: 1, batch_code: "SYS-ADMIN", created_at: new Date().toISOString()
    },
    moduleContent: {
        modules: [
            { module_id: 1, title: "Basic Electro-Pneumatics", module_code: "M1", description: "Offline Developer Access", order_no: 1 },
            { module_id: 2, title: "Advanced Relay Logic", module_code: "M2", description: "Offline Developer Access", order_no: 2 },
            { module_id: 3, title: "PLC Fundamentals", module_code: "M3", description: "Offline Developer Access", order_no: 3 },
        ],
        resources: [
            { resource_id: 1, module_id: 1, title: "System Override Protocol", type: "VIDEO", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", resolved_url: null, order_no: 1 },
            { resource_id: 2, module_id: 2, title: "Relay Override Protocol", type: "VIDEO", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", resolved_url: null, order_no: 1 },
            { resource_id: 3, module_id: 3, title: "PLC Override Protocol", type: "VIDEO", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", resolved_url: null, order_no: 1 }
        ],
        simulations: Array.from({ length: 10 }).map((_, i) => ({
            simulation_id: i + 1,
            module_id: Math.ceil((i + 1) / 3),
            title: `Simulation Override ${i + 1}`,
            is_required: true,
            order_no: i + 1
        }))
    },
    moduleStatus: [
        { module_id: 1, module_status: "COMPLETED", required_sims: 1, completed_required_sims: 1 },
        { module_id: 2, module_status: "COMPLETED", required_sims: 1, completed_required_sims: 1 },
        { module_id: 3, module_status: "COMPLETED", required_sims: 1, completed_required_sims: 1 },
    ],
    simulationProgress: Array.from({ length: 10 }).map((_, i) => ({
        simulation_id: i + 1, is_completed: true, best_score: 100
    }))
} as unknown as DashboardResponseApi;


export const getTraineeDashboard = async (
    options?: { signal?: AbortSignal }
): Promise<DashboardResponseApi> => {

    // 🚀 THE ULTIMATE SHORT-CIRCUIT 🚀
    // No token checks, no backend queries. 
    // If you are the Developer, you instantly get the fully populated dashboard.
    if (getAuthRole() === 'developer') {
        console.warn("DEV MODE: Detached from backend. Injecting offline curriculum.");
        return OFFLINE_DUMMY_DASHBOARD;
    }

    // --- STANDARD BEHAVIOR FOR REAL ACCOUNTS ---
    return requestJson<DashboardResponseApi>("/api/me/dashboard", {
        signal: options?.signal,
    });
};


export const completeSimulation = async (
    simulationId: number,
    body?: { bestScore?: number | null },
    options?: { signal?: AbortSignal }
): Promise<{ ok: boolean }> => {

    // 🚀 SHORT-CIRCUIT: Prevent offline developers from sending fake completion data to the backend
    if (getAuthRole() === 'developer') {
        return { ok: true };
    }

    const safeSimulationId = toPositiveInt(simulationId, "simulationId");
    return requestJson<{ ok: boolean }>(
        `/api/me/simulations/${safeSimulationId}/complete`,
        { method: "POST", body, signal: options?.signal }
    );
};

export const updateSimulationProgress = async (
    simulationId: number,
    body?: {
        status?: "IN_PROGRESS" | "COMPLETED";
        bestScore?: number | null;
        incrementAttempt?: boolean;
    },
    options?: { signal?: AbortSignal }
): Promise<{ ok: boolean }> => {

    if (getAuthRole() === 'developer') {
        return { ok: true };
    }

    const safeSimulationId = toPositiveInt(simulationId, "simulationId");
    return requestJson<{ ok: boolean }>(
        `/api/me/simulations/${safeSimulationId}/progress`,
        { method: "POST", body, signal: options?.signal }
    );
};
