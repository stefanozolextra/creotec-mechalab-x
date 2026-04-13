import { listAdminTrainees, type AdminTraineesListParams } from "./adminTrainees";
import { requestBlob, requestJson } from "./http";
import type { AdminTraineesListResponse, TraineeAccessMode } from "../types/adminTrainee";

type NumericLike = string | number;
export type AdminModuleReportingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LESSON_ONLY";

export type AdminTraineeModuleStatusItem = {
  module_id: NumericLike;
  module_code: string;
  module_title: string;
  required_sims: NumericLike;
  completed_required_sims: NumericLike;
  module_status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  quiz_required: boolean;
  quiz_passed: boolean;
  access_mode: TraineeAccessMode;
  reporting_status: AdminModuleReportingStatus;
};

export const listAdminTraineesReport = async (
  params: AdminTraineesListParams = {}
): Promise<AdminTraineesListResponse> => {
  return listAdminTrainees(params);
};

export const getAdminTraineeModuleStatus = async (
  id: number
): Promise<AdminTraineeModuleStatusItem[]> => {
  return requestJson<AdminTraineeModuleStatusItem[]>(`/api/admin/trainees/${id}/module-status`);
};

export const exportModuleStatusCsv = async (batchCode: string): Promise<Blob> => {
  const normalizedBatchCode = batchCode.trim().toUpperCase();
  const query = new URLSearchParams({ batch_code: normalizedBatchCode });
  return requestBlob(`/api/admin/reports/module-status.csv?${query.toString()}`);
};
