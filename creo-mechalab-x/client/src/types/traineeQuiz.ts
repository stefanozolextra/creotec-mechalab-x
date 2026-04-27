export type TraineeQuizStatus = "published";
export type TraineeQuizAttemptStatus = "in_progress" | "submitted" | "expired";

export type TraineeQuizAttempt = {
  attempt_id: number;
  quiz_id: number;
  attempt_no: number;
  status: TraineeQuizAttemptStatus;
  time_limit_seconds: number;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  remaining_seconds: number;
};

export type TraineeQuizResult = {
  attempt_id: number;
  quiz_id: number;
  attempt_no: number;
  status: Exclude<TraineeQuizAttemptStatus, "in_progress">;
  passed: boolean;
  submitted_at: string | null;
};

export type TraineeQuizChoice = {
  choice_id: number;
  choice_no: number;
  label: string;
  choice_text: string;
};

export type TraineeQuizQuestion = {
  question_id: number;
  order_no: number;
  question_text: string;
  choices: TraineeQuizChoice[];
};

export type TraineeQuizSavedAnswer = {
  attempt_id: number;
  question_id: number;
  question_order_no: number;
  selected_choice_id: number;
  created_at: string | null;
  updated_at: string | null;
};

export type TraineeQuizSummary = {
  quiz_id: number;
  module_id: number;
  module_code: string;
  module_title: string;
  title: string;
  status: TraineeQuizStatus;
  passing_score_percent: number;
  max_attempts: number;
  time_limit_minutes: number;
  question_count: number;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  attempts_used: number;
  attempts_remaining: number;
  current_attempt: TraineeQuizAttempt | null;
  latest_result: TraineeQuizResult | null;
  can_start: boolean;
  can_resume: boolean;
};

export type ModuleQuizSummaryResponse = {
  quiz: TraineeQuizSummary | null;
};

export type ModuleQuizAttemptResponse = {
  quiz: TraineeQuizSummary;
  attempt: TraineeQuizAttempt | null;
  questions: TraineeQuizQuestion[];
  saved_answers: TraineeQuizSavedAnswer[];
  expired: boolean;
  result: TraineeQuizResult | null;
  created?: boolean;
  resumed?: boolean;
};

export type SaveQuizAnswerResponse = {
  quiz: TraineeQuizSummary;
  attempt: TraineeQuizAttempt | null;
  saved_answer: TraineeQuizSavedAnswer | null;
  expired: boolean;
  result: TraineeQuizResult | null;
};

export type SubmitQuizResponse = {
  quiz: TraineeQuizSummary;
  result: TraineeQuizResult;
  expired: boolean;
};

export type ModuleQuizResultResponse = {
  quiz: TraineeQuizSummary;
  result: TraineeQuizResult;
};
