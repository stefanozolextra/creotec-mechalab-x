import { requestJson } from "./http";
import type { AdminTraineeItem, AdminTraineesListResponse } from "../types/adminTrainee";

export type AdminTraineesListParams = {
  search?: string;
  batch?: string;
  status?: "all" | "active" | "inactive";
  limit?: number;
  offset?: number;
};

export type AdminTraineePayload = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  contact_number?: string;
  batch_code?: string;
  batch_id?: number;
};

export type AdminCreateTraineeResponse = {
  item: AdminTraineeItem;
  generated_password?: string;
  password_delivery?: "manual";
};

const buildListQuery = (params: AdminTraineesListParams): string => {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set("search", params.search);
  if (params.batch) searchParams.set("batch", params.batch);
  if (params.status) searchParams.set("status", params.status);
  if (typeof params.limit === "number") searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") searchParams.set("offset", String(params.offset));

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const listAdminTrainees = async (
  params: AdminTraineesListParams = {}
): Promise<AdminTraineesListResponse> => {
  const query = buildListQuery(params);
  return requestJson<AdminTraineesListResponse>(`/api/admin/trainees${query}`);
};

export const createAdminTrainee = async (
  payload: AdminTraineePayload
): Promise<AdminCreateTraineeResponse> => {
  return requestJson<AdminCreateTraineeResponse>("/api/admin/trainees", {
    method: "POST",
    body: payload,
  });
};

export const updateAdminTrainee = async (
  id: string,
  payload: AdminTraineePayload
): Promise<{ item: AdminTraineeItem }> => {
  return requestJson<{ item: AdminTraineeItem }>(`/api/admin/trainees/${id}`, {
    method: "PUT",
    body: payload,
  });
};

export const setAdminTraineeStatus = async (
  id: string,
  status: "active" | "inactive"
): Promise<{ item: AdminTraineeItem }> => {
  return requestJson<{ item: AdminTraineeItem }>(`/api/admin/trainees/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
};

export const deleteAdminTrainee = async (
  id: number
): Promise<{ ok: boolean; deleted_trainee_id: number }> => {
  return requestJson<{ ok: boolean; deleted_trainee_id: number }>(`/api/admin/trainees/${id}`, {
    method: "DELETE",
  });
};
