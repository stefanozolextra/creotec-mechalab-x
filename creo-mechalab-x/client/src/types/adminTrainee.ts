export type BatchFilter = { batch_id: string; batch_code: string };
export type TraineeAccessMode = "standard" | "lesson_only";

export type AdminTraineeItem = {
  trainee_id: string;
  trainee_code: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  contact_number: string | null;
  access_mode: TraineeAccessMode;
  batch: { batch_id: string; batch_code: string };
  status: "active" | "inactive";
  progress: { completed_modules: number; total_modules: number; percent: number; label: string };
};

export type AdminTraineesListResponse = {
  items: AdminTraineeItem[];
  filters: { batches: BatchFilter[] };
};
