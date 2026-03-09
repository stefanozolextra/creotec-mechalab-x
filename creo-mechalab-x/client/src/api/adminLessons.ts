import { requestJson } from "./http";
import type { AdminLessonItem, AdminLessonsListResponse } from "../types/adminLesson";

const toPositiveInt = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

export const getAdminLessons = async (): Promise<AdminLessonsListResponse> => {
  return requestJson<AdminLessonsListResponse>("/api/admin/lessons");
};

export const updateAdminLessonTitle = async (
  moduleId: number,
  title: string,
): Promise<{ item: AdminLessonItem | null }> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Title cannot be empty.");
  }

  return requestJson<{ item: AdminLessonItem | null }>(`/api/admin/lessons/${safeModuleId}`, {
    method: "PATCH",
    body: { title: trimmedTitle },
  });
};

export const uploadAdminLessonPdf = async (
  moduleId: number,
  file: File,
): Promise<{ item: AdminLessonItem | null }> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<{ item: AdminLessonItem | null }>(`/api/admin/lessons/${safeModuleId}/pdf`, {
    method: "POST",
    body: formData,
  });
};

export const removeAdminLessonPdf = async (
  moduleId: number,
): Promise<{ item: AdminLessonItem | null; removed: boolean }> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<{ item: AdminLessonItem | null; removed: boolean }>(`/api/admin/lessons/${safeModuleId}/pdf`, {
    method: "DELETE",
  });
};
