export type AdminQuizStatus = "draft" | "published" | "archived";

export type AdminQuizModuleOption = {
  module_id: number;
  module_code: string;
  module_title: string;
  order_no: number;
  is_active: boolean;
};

export type AdminQuizListItem = {
  quiz_id: number;
  module_id: number;
  module_code: string;
  module_title: string;
  module_order_no: number;
  module_is_active: boolean;
  cloned_from_quiz_id: number | null;
  title: string;
  status: AdminQuizStatus;
  passing_score_percent: number;
  max_attempts: number;
  time_limit_minutes: number;
  question_count: number;
  attempt_count: number;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  has_attempts: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_archive: boolean;
  can_clone: boolean;
  can_delete: boolean;
};

export type AdminQuizChoice = {
  choice_id: number;
  question_id: number;
  choice_no: number;
  label: string;
  choice_text: string;
  is_correct: boolean;
};

export type AdminQuizQuestion = {
  question_id: number;
  quiz_id: number;
  question_text: string;
  order_no: number;
  choices: AdminQuizChoice[];
  choice_count: number;
  correct_choice_count: number;
};

export type AdminQuizDetail = AdminQuizListItem & {
  questions: AdminQuizQuestion[];
  stats: {
    question_count: number;
    attempt_count: number;
  };
  publish_checks: {
    ready: boolean;
    errors: string[];
  };
};

export type AdminQuizzesListResponse = {
  items: AdminQuizListItem[];
  modules: AdminQuizModuleOption[];
};

export type AdminQuizDetailResponse = {
  quiz: AdminQuizDetail | null;
};

export type AdminQuizMutationResponse = {
  quiz: AdminQuizDetail | null;
};
