import { requestJson } from "./http";
import type {
  AdminActivityLogsResponse,
  AdminActivityLogMode,
  AdminActivityLogType,
  AdminActivityLogNumeric,
  AdminTraineeProgressLogsResponse,
} from "../types/adminActivityLogs";

type NumericLike = number | string;

type RawAdminActivityLogItem = {
  event_id?: string;
  type?: string;
  occurred_at?: string;
  batch_code?: string | null;
  actor?: string | null;
  message?: string;
  trainee_id?: NumericLike;
  trainee_name?: string | null;
  trainee_code?: string | null;
  trainee_email?: string | null;
  module_id?: NumericLike;
  module_title?: string | null;
  simulation_id?: NumericLike;
  simulation_title?: string | null;
  status?: string | null;
  score?: NumericLike | null;
  attempt_count?: NumericLike | null;
  meta?: unknown;
};

type RawAdminActivityLogsResponse = {
  generated_at?: string;
  scope?: {
    mode?: string;
    batch_code?: string | null;
    search?: string | null;
  };
  paging?: {
    limit?: NumericLike;
    next_before?: string | null;
  };
  items?: RawAdminActivityLogItem[];
};

type GetAdminActivityLogsParams = {
  mode?: AdminActivityLogMode;
  batchCode?: string;
  search?: string;
  limit?: number;
  before?: string;
  signal?: AbortSignal;
};

export type GetAdminTraineeProgressActivityLogsParams = Omit<GetAdminActivityLogsParams, "mode">;

const toNumber = (value: NumericLike | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeType = (value: string | undefined): AdminActivityLogType => {
  if (value === "system_reset" || value === "trainee_created" || value === "simulation_completed") return value;
  return "batch_export";
};

const normalizeMode = (value: string | undefined): AdminActivityLogMode =>
  value === "trainee_progress" ? "trainee_progress" : "system";

const normalizeNumeric = (value: NumericLike | undefined | null): AdminActivityLogNumeric | undefined => {
  if (typeof value === "number" || typeof value === "string") return value;
  return undefined;
};

const normalizeOptionalNumber = (value: NumericLike | undefined | null): number | null | undefined => {
  if (value === null) return null;
  if (value === undefined) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const getAdminActivityLogs = async ({
  mode,
  batchCode,
  search,
  limit,
  before,
  signal,
}: GetAdminActivityLogsParams = {}): Promise<AdminActivityLogsResponse> => {
  const normalizedMode = mode === "trainee_progress" ? "trainee_progress" : "system";
  const normalizedBatchCode = typeof batchCode === "string" ? batchCode.trim().toUpperCase() : "";
  const normalizedSearch = typeof search === "string" ? search.trim() : "";
  const normalizedBefore = typeof before === "string" ? before.trim() : "";

  const searchParams = new URLSearchParams();
  if (normalizedMode !== "system") searchParams.set("mode", normalizedMode);
  if (normalizedBatchCode) searchParams.set("batch_code", normalizedBatchCode);
  if (normalizedMode === "trainee_progress" && normalizedSearch) searchParams.set("search", normalizedSearch);
  if (Number.isFinite(limit)) searchParams.set("limit", String(limit));
  if (normalizedBefore) searchParams.set("before", normalizedBefore);

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const response = await requestJson<RawAdminActivityLogsResponse>(`/api/admin/activity-logs${query}`, { signal });

  return {
    generated_at: response.generated_at ?? new Date().toISOString(),
    scope: {
      mode: normalizeMode(response.scope?.mode),
      batch_code: response.scope?.batch_code ?? null,
      search: typeof response.scope?.search === "string" ? response.scope.search : null,
    },
    paging: {
      limit: toNumber(response.paging?.limit, 50),
      next_before: typeof response.paging?.next_before === "string" ? response.paging.next_before : null,
    },
    items: (response.items ?? []).map((item, index) => {
      const normalizedItem = {
        event_id:
          typeof item.event_id === "string" && item.event_id.trim()
            ? item.event_id
            : `${normalizeType(item.type)}:${item.occurred_at ?? "unknown"}:${index}`,
        type: normalizeType(item.type),
        occurred_at: item.occurred_at ?? "",
        batch_code: item.batch_code ?? null,
        actor: item.actor ?? null,
        message: item.message ?? "",
        ...(item.meta && typeof item.meta === "object" ? { meta: item.meta as Record<string, unknown> } : {}),
      };

      const traineeId = normalizeNumeric(item.trainee_id);
      const moduleId = normalizeNumeric(item.module_id);
      const simulationId = normalizeNumeric(item.simulation_id);
      const score = normalizeOptionalNumber(item.score);
      const attemptCount = normalizeOptionalNumber(item.attempt_count);

      return {
        ...normalizedItem,
        ...(traineeId !== undefined ? { trainee_id: traineeId } : {}),
        ...(typeof item.trainee_name === "string" || item.trainee_name === null ? { trainee_name: item.trainee_name ?? null } : {}),
        ...(typeof item.trainee_code === "string" || item.trainee_code === null ? { trainee_code: item.trainee_code ?? null } : {}),
        ...(typeof item.trainee_email === "string" || item.trainee_email === null ? { trainee_email: item.trainee_email ?? null } : {}),
        ...(moduleId !== undefined ? { module_id: moduleId } : {}),
        ...(typeof item.module_title === "string" || item.module_title === null ? { module_title: item.module_title ?? null } : {}),
        ...(simulationId !== undefined ? { simulation_id: simulationId } : {}),
        ...(typeof item.simulation_title === "string" || item.simulation_title === null ? { simulation_title: item.simulation_title ?? null } : {}),
        ...(typeof item.status === "string" || item.status === null ? { status: item.status ?? null } : {}),
        ...(score !== undefined ? { score } : {}),
        ...(attemptCount !== undefined ? { attempt_count: attemptCount } : {}),
      };
    }),
  };
};

export const getAdminTraineeProgressActivityLogs = async (
  params: GetAdminTraineeProgressActivityLogsParams = {}
): Promise<AdminTraineeProgressLogsResponse> => {
  const response = await getAdminActivityLogs({
    ...params,
    mode: "trainee_progress",
  });

  return {
    ...response,
    scope: {
      ...response.scope,
      mode: "trainee_progress",
    },
  };
};
