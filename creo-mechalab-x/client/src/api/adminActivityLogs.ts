import { requestJson } from "./http";
import type { AdminActivityLogsResponse, AdminActivityLogType } from "../types/adminActivityLogs";

type NumericLike = number | string;

type RawAdminActivityLogItem = {
  type?: string;
  occurred_at?: string;
  batch_code?: string | null;
  actor?: string | null;
  message?: string;
  meta?: unknown;
};

type RawAdminActivityLogsResponse = {
  generated_at?: string;
  scope?: {
    batch_code?: string | null;
  };
  paging?: {
    limit?: NumericLike;
    next_before?: string | null;
  };
  items?: RawAdminActivityLogItem[];
};

type GetAdminActivityLogsParams = {
  batchCode?: string;
  limit?: number;
  before?: string;
  signal?: AbortSignal;
};

const toNumber = (value: NumericLike | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeType = (value: string | undefined): AdminActivityLogType => {
  if (value === "system_reset" || value === "trainee_created") return value;
  return "batch_export";
};

export const getAdminActivityLogs = async ({
  batchCode,
  limit,
  before,
  signal,
}: GetAdminActivityLogsParams = {}): Promise<AdminActivityLogsResponse> => {
  const normalizedBatchCode = typeof batchCode === "string" ? batchCode.trim().toUpperCase() : "";
  const normalizedBefore = typeof before === "string" ? before.trim() : "";

  const searchParams = new URLSearchParams();
  if (normalizedBatchCode) searchParams.set("batch_code", normalizedBatchCode);
  if (Number.isFinite(limit)) searchParams.set("limit", String(limit));
  if (normalizedBefore) searchParams.set("before", normalizedBefore);

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const response = await requestJson<RawAdminActivityLogsResponse>(`/api/admin/activity-logs${query}`, { signal });

  return {
    generated_at: response.generated_at ?? new Date().toISOString(),
    scope: {
      batch_code: response.scope?.batch_code ?? null,
    },
    paging: {
      limit: toNumber(response.paging?.limit, 50),
      next_before: typeof response.paging?.next_before === "string" ? response.paging.next_before : null,
    },
    items: (response.items ?? []).map((item) => ({
      type: normalizeType(item.type),
      occurred_at: item.occurred_at ?? "",
      batch_code: item.batch_code ?? null,
      actor: item.actor ?? null,
      message: item.message ?? "",
      ...(item.meta && typeof item.meta === "object" ? { meta: item.meta as Record<string, unknown> } : {}),
    })),
  };
};
