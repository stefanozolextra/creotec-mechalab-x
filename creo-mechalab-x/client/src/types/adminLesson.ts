export type AdminLessonPdfState = {
  resource_id: number | null;
  has_pdf: boolean;
  has_uploaded_file: boolean;
  file_id: number | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  view_url: string | null;
};

export type AdminLessonItem = {
  module_id: number;
  module_code: string;
  module_title: string;
  description: string | null;
  order_no: number;
  is_active: boolean;
  pdf: AdminLessonPdfState;
};

export type AdminLessonsListResponse = {
  items: AdminLessonItem[];
};
