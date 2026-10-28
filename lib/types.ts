export type User = { id: string; username: string };

export type Subject = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type Lesson = {
  id: string;
  subject_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  color: string;
};

export type HomeworkRow = {
  id: string;
  subject_id: string;
  title: string;
  notes: string | null;
  done: boolean;
  due_date: string | null;
  created_date: string;
  subject_name: string;
  subject_color: string;
};

export type Homework = HomeworkRow & { due: string | null };

export type FolderRow = {
  id: string;
  name: string;
  files_count: number;
};

export type FileRow = {
  id: string;
  name: string;
  mime: string;
  size: number;
  subject_id: string | null;
  folder_id: string | null;
  project_id: string | null;
  created_date: string;
};

export type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "done";
  created_date: string;
  files_count: number;
  events_count: number;
  next_event: string | null;
};

export type ProjectEvent = {
  id: string;
  project_id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  notes: string | null;
  project_title?: string;
};

export const SUBJECT_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#0d9488",
  "#8b5cf6",
  "#0284c7",
  "#e11d48",
  "#16a34a",
  "#ca8a04",
  "#0891b2",
] as const;
