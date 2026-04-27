import { requestJson } from "./http";
import type { DashboardResponseApi } from "../types/traineeDashboard";
import { isGodModeSession } from "../utils/auth";

const toPositiveInt = (value: number, label: string): number => {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid ${label}.`);
    }
    return value;
};

export const getTraineeDashboard = async (
    options?: { signal?: AbortSignal }
): Promise<DashboardResponseApi> => {

    // 🚀 THE ULTIMATE SHORT-CIRCUIT 🚀
    // No token checks, no backend trainee validation. 
    // If you are the Developer, you get the live curriculum data injected into a simulated dashboard struct!
    if (isGodModeSession()) {
        const data = await requestJson<any>("/api/curriculum/public?include_simulations=developer", {
            signal: options?.signal,
        });
        
        return {
            trainee: {
                trainee_id: 999999, account_id: 999999, first_name: "God Mode", last_name: "Developer",
                trainee_code: "DEV-OVERRIDE", batch_id: 1, batch_code: "SYS-ADMIN", created_at: new Date().toISOString(),
                access_mode: "standard",
            },
            moduleContent: {
                modules: data.modules,
                resources: data.resources,
                simulations: data.simulations
            },
            // Auto-complete all tasks to unlock navigation for the developer
            moduleStatus: data.modules.map((m: any) => ({ module_id: m.module_id, module_status: "COMPLETED", required_sims: 1, completed_required_sims: 1 })),
            simulationProgress: data.simulations.map((s: any) => ({ simulation_id: s.simulation_id, is_completed: true, best_score: 100 }))
        } as unknown as DashboardResponseApi;
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

    if (isGodModeSession()) {
        return { ok: true };
    }

    const safeSimulationId = toPositiveInt(simulationId, "simulationId");
    return requestJson<{ ok: boolean }>(
        `/api/me/simulations/${safeSimulationId}/complete`,
        { method: "POST", body, signal: options?.signal }
    );
};
