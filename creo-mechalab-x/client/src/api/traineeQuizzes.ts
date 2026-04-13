import { requestJson } from "./http";
import type {
  ModuleQuizAttemptResponse,
  ModuleQuizResultResponse,
  ModuleQuizSummaryResponse,
  SaveQuizAnswerResponse,
  SubmitQuizResponse,
} from "../types/traineeQuiz";

const toPositiveInt = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

export const getModuleQuizSummary = async (
  moduleId: number,
  options?: { signal?: AbortSignal },
): Promise<ModuleQuizSummaryResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<ModuleQuizSummaryResponse>(`/api/me/modules/${safeModuleId}/quiz`, {
    signal: options?.signal,
  });
};

export const startOrResumeModuleQuiz = async (moduleId: number): Promise<ModuleQuizAttemptResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<ModuleQuizAttemptResponse>(`/api/me/modules/${safeModuleId}/quiz/attempt`, {
    method: "POST",
  });
};

export const getModuleQuizAttempt = async (
  moduleId: number,
  options?: { signal?: AbortSignal },
): Promise<ModuleQuizAttemptResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<ModuleQuizAttemptResponse>(`/api/me/modules/${safeModuleId}/quiz/attempt`, {
    signal: options?.signal,
  });
};

export const saveModuleQuizAnswer = async (
  moduleId: number,
  questionId: number,
  selectedChoiceId: number,
): Promise<SaveQuizAnswerResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  const safeQuestionId = toPositiveInt(questionId, "questionId");
  const safeSelectedChoiceId = toPositiveInt(selectedChoiceId, "selectedChoiceId");

  return requestJson<SaveQuizAnswerResponse>(
    `/api/me/modules/${safeModuleId}/quiz/answers/${safeQuestionId}`,
    {
      method: "PUT",
      body: {
        selected_choice_id: safeSelectedChoiceId,
      },
    },
  );
};

export const submitModuleQuiz = async (moduleId: number): Promise<SubmitQuizResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<SubmitQuizResponse>(`/api/me/modules/${safeModuleId}/quiz/submit`, {
    method: "POST",
  });
};

export const getModuleQuizResult = async (
  moduleId: number,
  options?: { signal?: AbortSignal },
): Promise<ModuleQuizResultResponse> => {
  const safeModuleId = toPositiveInt(moduleId, "moduleId");
  return requestJson<ModuleQuizResultResponse>(`/api/me/modules/${safeModuleId}/quiz/result`, {
    signal: options?.signal,
  });
};
