import { requestJson } from "./http";
import type {
  AdminQuizDetailResponse,
  AdminQuizMutationResponse,
  AdminQuizzesListResponse,
} from "../types/adminQuiz";

const toPositiveInt = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

export const listAdminQuizzes = async (): Promise<AdminQuizzesListResponse> => {
  return requestJson<AdminQuizzesListResponse>("/api/admin/quizzes");
};

export const getAdminQuizDetail = async (quizId: number): Promise<AdminQuizDetailResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  return requestJson<AdminQuizDetailResponse>(`/api/admin/quizzes/${safeQuizId}`);
};

export const createAdminQuizDraft = async (payload: {
  module_id: number;
  title: string;
  max_attempts: number;
  time_limit_minutes: number;
}): Promise<AdminQuizMutationResponse> => {
  return requestJson<AdminQuizMutationResponse>("/api/admin/quizzes", {
    method: "POST",
    body: {
      module_id: toPositiveInt(payload.module_id, "module_id"),
      title: payload.title.trim(),
      max_attempts: toPositiveInt(payload.max_attempts, "max_attempts"),
      time_limit_minutes: toPositiveInt(payload.time_limit_minutes, "time_limit_minutes"),
    },
  });
};

export const updateAdminQuizDraft = async (
  quizId: number,
  payload: Partial<{
    module_id: number;
    title: string;
    max_attempts: number;
    time_limit_minutes: number;
  }>,
): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const body: Record<string, unknown> = {};

  if (payload.module_id !== undefined) {
    body.module_id = toPositiveInt(payload.module_id, "module_id");
  }
  if (payload.title !== undefined) {
    body.title = payload.title.trim();
  }
  if (payload.max_attempts !== undefined) {
    body.max_attempts = toPositiveInt(payload.max_attempts, "max_attempts");
  }
  if (payload.time_limit_minutes !== undefined) {
    body.time_limit_minutes = toPositiveInt(payload.time_limit_minutes, "time_limit_minutes");
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No draft quiz fields to update.");
  }

  return requestJson<AdminQuizMutationResponse>(`/api/admin/quizzes/${safeQuizId}`, {
    method: "PATCH",
    body,
  });
};

export const addAdminQuizQuestion = async (
  quizId: number,
  questionText: string,
): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const trimmedQuestionText = questionText.trim();
  if (!trimmedQuestionText) {
    throw new Error("Question text cannot be empty.");
  }

  return requestJson<AdminQuizMutationResponse>(`/api/admin/quizzes/${safeQuizId}/questions`, {
    method: "POST",
    body: {
      question_text: trimmedQuestionText,
    },
  });
};

export const updateAdminQuizQuestion = async (
  quizId: number,
  questionId: number,
  payload: Partial<{
    question_text: string;
    order_no: number;
  }>,
): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");
  const body: Record<string, unknown> = {};

  if (payload.question_text !== undefined) {
    const trimmedQuestionText = payload.question_text.trim();
    if (!trimmedQuestionText) {
      throw new Error("Question text cannot be empty.");
    }
    body.question_text = trimmedQuestionText;
  }
  if (payload.order_no !== undefined) {
    body.order_no = toPositiveInt(payload.order_no, "order_no");
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No question fields to update.");
  }

  return requestJson<AdminQuizMutationResponse>(
    `/api/admin/quizzes/${safeQuizId}/questions/${safeQuestionId}`,
    {
      method: "PATCH",
      body,
    },
  );
};

export const deleteAdminQuizQuestion = async (
  quizId: number,
  questionId: number,
): Promise<AdminQuizMutationResponse & { removed: boolean }> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");

  return requestJson<AdminQuizMutationResponse & { removed: boolean }>(
    `/api/admin/quizzes/${safeQuizId}/questions/${safeQuestionId}`,
    {
      method: "DELETE",
    },
  );
};

export const addAdminQuizChoice = async (
  quizId: number,
  questionId: number,
  payload: {
    choice_text: string;
    is_correct?: boolean;
  },
): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");
  const trimmedChoiceText = payload.choice_text.trim();
  if (!trimmedChoiceText) {
    throw new Error("Choice text cannot be empty.");
  }

  return requestJson<AdminQuizMutationResponse>(
    `/api/admin/quizzes/${safeQuizId}/questions/${safeQuestionId}/choices`,
    {
      method: "POST",
      body: {
        choice_text: trimmedChoiceText,
        ...(payload.is_correct === true ? { is_correct: true } : {}),
      },
    },
  );
};

export const updateAdminQuizChoice = async (
  quizId: number,
  questionId: number,
  choiceId: number,
  payload: Partial<{
    choice_text: string;
    is_correct: boolean;
  }>,
): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");
  const safeChoiceId = toPositiveInt(choiceId, "choiceId");
  const body: Record<string, unknown> = {};

  if (payload.choice_text !== undefined) {
    const trimmedChoiceText = payload.choice_text.trim();
    if (!trimmedChoiceText) {
      throw new Error("Choice text cannot be empty.");
    }
    body.choice_text = trimmedChoiceText;
  }
  if (payload.is_correct !== undefined) {
    body.is_correct = payload.is_correct;
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No choice fields to update.");
  }

  return requestJson<AdminQuizMutationResponse>(
    `/api/admin/quizzes/${safeQuizId}/questions/${safeQuestionId}/choices/${safeChoiceId}`,
    {
      method: "PATCH",
      body,
    },
  );
};

export const deleteAdminQuizChoice = async (
  quizId: number,
  questionId: number,
  choiceId: number,
): Promise<AdminQuizMutationResponse & { removed: boolean }> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");
  const safeChoiceId = toPositiveInt(choiceId, "choiceId");

  return requestJson<AdminQuizMutationResponse & { removed: boolean }>(
    `/api/admin/quizzes/${safeQuizId}/questions/${safeQuestionId}/choices/${safeChoiceId}`,
    {
      method: "DELETE",
    },
  );
};

export const publishAdminQuiz = async (quizId: number): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  return requestJson<AdminQuizMutationResponse>(`/api/admin/quizzes/${safeQuizId}/publish`, {
    method: "POST",
  });
};

export const archiveAdminQuiz = async (quizId: number): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  return requestJson<AdminQuizMutationResponse>(`/api/admin/quizzes/${safeQuizId}/archive`, {
    method: "POST",
  });
};

export const cloneAdminQuizToDraft = async (quizId: number): Promise<AdminQuizMutationResponse> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  return requestJson<AdminQuizMutationResponse>(`/api/admin/quizzes/${safeQuizId}/clone`, {
    method: "POST",
  });
};

export const deleteAdminQuiz = async (quizId: number): Promise<{ removed: boolean }> => {
  const safeQuizId = toPositiveInt(quizId, "quizId");
  return requestJson<{ removed: boolean }>(`/api/admin/quizzes/${safeQuizId}`, {
    method: "DELETE",
  });
};
