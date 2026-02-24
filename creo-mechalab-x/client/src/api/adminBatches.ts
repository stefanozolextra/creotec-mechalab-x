import { requestJson } from "./http";
import type { AdminBatchItem } from "../types/adminBatch";

type RawAdminBatchItem = {
  batch_id: number | string;
  batch_code: string;
  trainee_count: number | string;
};

type RawAdminBatchesResponse = {
  items: RawAdminBatchItem[];
};

export type AdminBatchesResponse = {
  items: AdminBatchItem[];
};

const toNumber = (value: number | string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const listAdminBatches = async (): Promise<AdminBatchesResponse> => {
  const response = await requestJson<RawAdminBatchesResponse>("/api/admin/batches");
  return {
    items: (response.items ?? []).map((item) => ({
      batch_id: toNumber(item.batch_id),
      batch_code: item.batch_code,
      trainee_count: toNumber(item.trainee_count),
    })),
  };
};
