import { listAdminTrainees, type AdminTraineesListParams } from "./adminTrainees";
import { requestJson } from "./http";
import type { AdminTraineesListResponse } from "../types/adminTrainee";

type NumericLike = string | number;

export type AdminTraineeModuleStatusItem = {
  module_id: NumericLike;
  module_code: string;
  module_title: string;
  required_sims: NumericLike;
  completed_required_sims: NumericLike;
  module_status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
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
