export type BookFormat = "pdf" | "docx" | "txt" | "manual" | "epub";

export interface ReadingProgress {
  book_id: string;
  current_page: number;
  total_pages: number;
  percentage: number;
  reading_time_seconds: number;
  last_read_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  cover_url?: string | null;
  total_pages_estimated: number;
  is_favorite: boolean;
  is_finished: boolean;
  created_at: string;
  updated_at: string;
  progress?: ReadingProgress | null;
}

export interface BookDetail extends Book {
  content: string;
  annotations?: Annotation[];
}

export interface BookCreateInput {
  title: string;
  author?: string;
  format?: BookFormat;
  cover_url?: string | null;
  content: string;
  total_pages_estimated?: number;
}

export interface Annotation {
  id: string;
  book_id: string;
  page_number: number;
  selected_text: string;
  color: string;
  note?: string | null;
  created_at: string;
}
