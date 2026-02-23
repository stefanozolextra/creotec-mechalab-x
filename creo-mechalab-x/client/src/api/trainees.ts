import { requestJson } from "./http";
import type { DashboardResponseApi } from "../types/traineeDashboard";

const toPositiveInt = (value: number, label: string): number => {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Invalid ${label}.`);
    }
    return value;
};

export const getDefaultTraineeId = (): number => {
    const parsed = Number(import.meta.env.VITE_DEFAULT_TRAINEE_ID);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const getTraineeDashboard = (
    traineeId: number,
    options?: { signal?: AbortSignal }
): Promise<DashboardResponseApi> => {
    const safeTraineeId = toPositiveInt(traineeId, "traineeId");
    return requestJson<DashboardResponseApi>(`/api/trainees/${safeTraineeId}/dashboard`, {
        signal: options?.signal,
    });
};

export const completeSimulation = (
    traineeId: number,
    simulationId: number,
    body?: { bestScore?: number | null },
    options?: { signal?: AbortSignal }
): Promise<{ ok: boolean }> => {
    const safeTraineeId = toPositiveInt(traineeId, "traineeId");
    const safeSimulationId = toPositiveInt(simulationId, "simulationId");

    return requestJson<{ ok: boolean }>(
        `/api/trainees/${safeTraineeId}/simulations/${safeSimulationId}/complete`,
        {
            method: "POST",
            body,
            signal: options?.signal,
        }
    );
};
