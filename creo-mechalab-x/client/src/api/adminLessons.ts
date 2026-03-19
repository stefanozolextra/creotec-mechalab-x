import { requestJson } from "./http";
import type {
    AdminLessonItem,
    AdminLessonMutationResponse,
    AdminLessonsListResponse,
    AdminModuleLessonsResponse,
    AdminLessonResourceType,
} from "../types/adminLesson";

const toPositiveInt = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

export const getAdminLessons = async (): Promise<AdminLessonsListResponse> => {
  return requestJson<AdminLessonsListResponse>("/api/admin/lessons");
};

export const createAdminLesson = async (
  title: string,
): Promise<{ item: AdminLessonItem | null }> => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Title cannot be empty.");
  }

  return requestJson<{ item: AdminLessonItem | null }>("/api/admin/lessons", {
    method: "POST",
    body: { title: trimmedTitle },
  });
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

export const getAdminModuleLessons = async (
  moduleId: number,
): Promise<AdminModuleLessonsResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<AdminModuleLessonsResponse>(`/api/admin/modules/${safeModuleId}/lessons`);
};

export const createAdminModuleLesson = async (
  moduleId: number,
  payload: { title: string; type: AdminLessonResourceType; url?: string },
): Promise<AdminLessonMutationResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const trimmedTitle = payload.title.trim();
  if (!trimmedTitle) {
    throw new Error("Lesson title cannot be empty.");
  }
  const normalizedType = payload.type === "VIDEO" ? "VIDEO" : "PDF";
  const trimmedUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  if (normalizedType === "VIDEO" && !trimmedUrl) {
    throw new Error("Video URL cannot be empty.");
  }

  return requestJson<AdminLessonMutationResponse>(`/api/admin/modules/${safeModuleId}/lessons`, {
    method: "POST",
    body: {
      title: trimmedTitle,
      type: normalizedType,
      ...(normalizedType === "VIDEO" ? { url: trimmedUrl, video_url: trimmedUrl } : {}),
    },
  });
};

export const updateAdminModuleLesson = async (
  moduleId: number,
  resourceId: number,
  payload: { title?: string; order_no?: number; type?: AdminLessonResourceType; url?: string },
): Promise<AdminLessonMutationResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const safeResourceId = toPositiveInt(resourceId, "resourceId");

  const body: {
    title?: string;
    order_no?: number;
    type?: AdminLessonResourceType;
    url?: string;
    video_url?: string;
  } = {};
  if (payload.title !== undefined) {
    const trimmedTitle = payload.title.trim();
    if (!trimmedTitle) {
      throw new Error("Lesson title cannot be empty.");
    }
    body.title = trimmedTitle;
  }
  if (payload.order_no !== undefined) {
    body.order_no = toPositiveInt(payload.order_no, "order_no");
  }
  if (payload.type !== undefined) {
    body.type = payload.type === "VIDEO" ? "VIDEO" : "PDF";
  }
  if (payload.url !== undefined) {
    const trimmedUrl = payload.url.trim();
    if (body.type === "VIDEO" && !trimmedUrl) {
      throw new Error("Video URL cannot be empty.");
    }
    body.url = trimmedUrl;
    if (body.type === "VIDEO") {
      body.video_url = trimmedUrl;
    }
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No lesson fields to update.");
  }

  return requestJson<AdminLessonMutationResponse>(
    `/api/admin/modules/${safeModuleId}/lessons/${safeResourceId}`,
    {
      method: "PATCH",
      body,
    },
  );
};

export const deleteAdminModuleLesson = async (
  moduleId: number,
  resourceId: number,
): Promise<{ item: AdminLessonItem | null; removed: boolean }> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const safeResourceId = toPositiveInt(resourceId, "resourceId");

  return requestJson<{ item: AdminLessonItem | null; removed: boolean }>(
    `/api/admin/modules/${safeModuleId}/lessons/${safeResourceId}`,
    {
      method: "DELETE",
    },
  );
};

export const uploadAdminModuleLessonPdf = async (
  moduleId: number,
  resourceId: number,
  file: File,
): Promise<AdminLessonMutationResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const safeResourceId = toPositiveInt(resourceId, "resourceId");
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<AdminLessonMutationResponse>(
    `/api/admin/modules/${safeModuleId}/lessons/${safeResourceId}/pdf`,
    {
      method: "POST",
      body: formData,
    },
  );
};

export const removeAdminModuleLessonPdf = async (
  moduleId: number,
  resourceId: number,
): Promise<{ item: AdminLessonItem | null; lesson: AdminLessonMutationResponse["lesson"]; removed: boolean }> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const safeResourceId = toPositiveInt(resourceId, "resourceId");

  return requestJson<{ item: AdminLessonItem | null; lesson: AdminLessonMutationResponse["lesson"]; removed: boolean }>(
    `/api/admin/modules/${safeModuleId}/lessons/${safeResourceId}/pdf`,
    {
      method: "DELETE",
    },
  );
};
