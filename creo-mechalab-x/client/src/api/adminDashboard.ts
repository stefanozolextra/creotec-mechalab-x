import { requestJson } from "./http";
import type { AdminDashboardResponse } from "../types/adminDashboard";

type NumericLike = number | string;

type RawAdminDashboardChartPoint = {
  module_id: NumericLike;
  module_code: string;
  module_title: string;
  completed_trainees: NumericLike;
  total_trainees: NumericLike;
  completion_percent: NumericLike;
};

type RawAdminDashboardFeedItem = {
  type: string;
  occurred_at: string;
  batch_code: string | null;
  actor: string | null;
  message: string;
};

type RawAdminDashboardResponse = {
  generated_at: string;
  scope?: {
    batch_code?: string | null;
  };
  summary?: {
    total_trainees?: NumericLike;
    total_modules?: NumericLike;
    progress_percent?: NumericLike;
    completed_module_rows?: NumericLike;
    total_module_rows?: NumericLike;
  };
  chart?: {
    kind?: "module_completion_percent";
    points?: RawAdminDashboardChartPoint[];
  };
  notifications?: RawAdminDashboardFeedItem[];
  activities?: RawAdminDashboardFeedItem[];
};

const toNumber = (value: NumericLike | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getAdminDashboard = async (batchCode?: string): Promise<AdminDashboardResponse> => {
  const normalizedBatchCode = typeof batchCode === "string" ? batchCode.trim().toUpperCase() : "";
  const query = normalizedBatchCode
    ? `?${new URLSearchParams({ batch_code: normalizedBatchCode }).toString()}`
    : "";

  const response = await requestJson<RawAdminDashboardResponse>(`/api/admin/dashboard${query}`);
  const points = (response.chart?.points ?? []).map((point) => ({
    module_id: toNumber(point.module_id),
    module_code: point.module_code ?? "",
    module_title: point.module_title ?? "",
    completed_trainees: toNumber(point.completed_trainees),
    total_trainees: toNumber(point.total_trainees),
    completion_percent: toNumber(point.completion_percent),
  }));

  const notifications = response.notifications ?? [];
  const activities = response.activities ?? [];

  return {
    generated_at: response.generated_at ?? new Date().toISOString(),
    scope: {
      batch_code: response.scope?.batch_code ?? null,
    },
    summary: {
      total_trainees: toNumber(response.summary?.total_trainees),
      total_modules: toNumber(response.summary?.total_modules),
      progress_percent: toNumber(response.summary?.progress_percent),
      completed_module_rows: toNumber(response.summary?.completed_module_rows),
      total_module_rows: toNumber(response.summary?.total_module_rows),
    },
    chart: {
      kind: "module_completion_percent",
      points,
    },
    notifications: notifications.map((item) => ({
      type: item.type ?? "event",
      occurred_at: item.occurred_at ?? "",
      batch_code: item.batch_code ?? null,
      actor: item.actor ?? null,
      message: item.message ?? "",
    })),
    activities: activities.map((item) => ({
      type: item.type ?? "event",
      occurred_at: item.occurred_at ?? "",
      batch_code: item.batch_code ?? null,
      actor: item.actor ?? null,
      message: item.message ?? "",
    })),
  };
};
