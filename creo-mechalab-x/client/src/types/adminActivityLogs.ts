export type AdminActivityLogMode = "system" | "trainee_progress";
export type AdminActivityLogType =
  | "batch_export"
  | "system_reset"
  | "trainee_created"
  | "simulation_progress"
  | "simulation_completed";
export type AdminActivityLogNumeric = number | string;

export type AdminActivityLogItem = {
  event_id: string;
  type: AdminActivityLogType;
  occurred_at: string;
  batch_code: string | null;
  actor: string | null;
  message: string;
  trainee_id?: AdminActivityLogNumeric;
  trainee_name?: string | null;
  trainee_code?: string | null;
  trainee_email?: string | null;
  module_id?: AdminActivityLogNumeric;
  module_title?: string | null;
  simulation_id?: AdminActivityLogNumeric;
  simulation_title?: string | null;
  status?: string | null;
  score?: number | null;
  attempt_count?: number | null;
  meta?: Record<string, unknown>;
};

export type AdminActivityLogsResponse = {
  generated_at: string;
  scope: {
    mode: AdminActivityLogMode;
    batch_code: string | null;
    search: string | null;
  };
  paging: {
    limit: number;
    next_before: string | null;
  };
  items: AdminActivityLogItem[];
};

export type AdminTraineeProgressLogItem = AdminActivityLogItem;

export type AdminTraineeProgressLogsResponse = Omit<AdminActivityLogsResponse, "scope" | "items"> & {
  scope: {
    mode: "trainee_progress";
    batch_code: string | null;
    search: string | null;
  };
  items: AdminTraineeProgressLogItem[];
};
