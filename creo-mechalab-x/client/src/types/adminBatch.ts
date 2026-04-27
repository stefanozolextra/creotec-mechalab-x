export type AdminBatchItem = {
  batch_id: number;
  batch_code: string;
  trainee_count: number;
  last_export_at: string | null;
  last_reset_at: string | null;
};
