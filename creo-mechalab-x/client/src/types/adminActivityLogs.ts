export type AdminActivityLogType = "batch_export" | "system_reset" | "trainee_created";

export type AdminActivityLogItem = {
  type: AdminActivityLogType;
  occurred_at: string;
  batch_code: string | null;
  actor: string | null;
  message: string;
  meta?: Record<string, unknown>;
};

export type AdminActivityLogsResponse = {
  generated_at: string;
  scope: {
    batch_code: string | null;
  };
  paging: {
    limit: number;
    next_before: string | null;
  };
  items: AdminActivityLogItem[];
};
