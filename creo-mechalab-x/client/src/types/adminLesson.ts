export type AdminLessonResourceType = "PDF" | "VIDEO";

export type AdminSimulationItem = {
  simulation_id: number;
  module_id: number | null;
  module_code: string | null;
  module_title: string | null;
  simulation_code: string;
  title: string;
  description: string | null;
  order_no: number;
  route_id: string | null;
  runtime_module_id: number | null;
  runtime_module_code: string | null;
  runtime_module_title: string | null;
  is_required: boolean;
};

export type AdminLessonResource = {
  resource_id: number;
  module_id: number;
  type: AdminLessonResourceType;
  title: string;
  url: string;
  order_no: number;
  has_uploaded_file: boolean;
  file_id: number | null;
  file_name: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  resolved_url: string | null;
  view_url: string | null;
};

export type AdminLessonItem = {
  module_id: number;
  module_code: string;
  module_title: string;
  description: string | null;
  order_no: number;
  is_active: boolean;
  lessons: AdminLessonResource[];
  simulations: AdminSimulationItem[];
};

export type AdminLessonsListResponse = {
  items: AdminLessonItem[];
};

export type AdminModuleLessonsResponse = {
  module: AdminLessonItem | null;
  lessons: AdminLessonResource[];
};

export type AdminLessonMutationResponse = {
  item: AdminLessonItem | null;
  lesson: AdminLessonResource | null;
};
