export type AdminLessonResourceType = "PDF" | "VIDEO";

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
