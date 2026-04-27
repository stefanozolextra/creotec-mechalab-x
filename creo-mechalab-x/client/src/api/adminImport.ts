import { requestJson } from "./http";
import type { BatchFilter } from "../types/adminTrainee";

export type AdminImportMode = "append" | "replace_old_batches";

export type AdminImportSummary = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type AdminImportRowError = {
  row: number;
  email: string;
  error: string;
};

export type AdminImportResponse = {
  batch: { batch_id: string; batch_code: string };
  summary: AdminImportSummary;
  row_errors: AdminImportRowError[];
};

export type AdminBatchesResponse = { items: BatchFilter[] };
export type AdminCreateBatchResponse = { item: BatchFilter };

export type ImportTraineesCsvPayload = {
  batch_code: string;
  file: File;
  mode?: AdminImportMode;
  confirm?: string;
};

export const getAdminBatches = async (): Promise<AdminBatchesResponse> => {
  return requestJson<AdminBatchesResponse>("/api/admin/batches");
};

export const createAdminBatch = async (batch_code: string): Promise<AdminCreateBatchResponse> => {
  return requestJson<AdminCreateBatchResponse>("/api/admin/batches", {
    method: "POST",
    body: { batch_code },
  });
};

export const importTraineesCsv = async (payload: ImportTraineesCsvPayload): Promise<AdminImportResponse> => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("batch_code", payload.batch_code);
  formData.append("mode", payload.mode ?? "append");
  if (payload.confirm) {
    formData.append("confirm", payload.confirm);
  }

  return requestJson<AdminImportResponse>("/api/admin/trainees/import-csv", {
    method: "POST",
    body: formData,
  });
};
