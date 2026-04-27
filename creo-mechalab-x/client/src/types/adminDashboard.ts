export type AdminDashboardSummary = {
  total_trainees: number;
  standard_trainees: number;
  lesson_only_trainees: number;
  total_modules: number;
  progress_percent: number;
  completed_module_rows: number;
  total_module_rows: number;
};

export type AdminDashboardChartPoint = {
  module_id: number;
  module_code: string;
  module_title: string;
  completed_trainees: number;
  total_trainees: number;
  completion_percent: number;
};

export type AdminDashboardChart = {
  kind: "module_completion_percent";
  points: AdminDashboardChartPoint[];
};

export type AdminDashboardFeedItem = {
  type: string;
  occurred_at: string;
  batch_code: string | null;
  actor: string | null;
  message: string;
};

export type AdminDashboardResponse = {
  generated_at: string;
  scope: {
    batch_code: string | null;
  };
  summary: AdminDashboardSummary;
  chart: AdminDashboardChart;
  notifications: AdminDashboardFeedItem[];
  activities: AdminDashboardFeedItem[];
};
