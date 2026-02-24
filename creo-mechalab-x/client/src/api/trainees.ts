import { requestJson } from "./http";
import type { DashboardResponseApi } from "../types/traineeDashboard";

const toPositiveInt = (value: number, label: string): number => {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid ${label}.`);
    }
    return value;
};

export const getTraineeDashboard = (
    options?: { signal?: AbortSignal }
): Promise<DashboardResponseApi> => {
    return requestJson<DashboardResponseApi>("/api/me/dashboard", {
        signal: options?.signal,
    });
};

export const completeSimulation = (
    simulationId: number,
    body?: { bestScore?: number | null },
    options?: { signal?: AbortSignal }
): Promise<{ ok: boolean }> => {
    const safeSimulationId = toPositiveInt(simulationId, "simulationId");

    return requestJson<{ ok: boolean }>(
        `/api/me/simulations/${safeSimulationId}/complete`,
        {
            method: "POST",
            body,
            signal: options?.signal,
        }
    );
};
