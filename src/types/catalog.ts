export interface CatalogBookItem {
  id: number;
  title: string;
  authors: string[];
  languages: string[];
  subjects: string[];
  cover_url?: string;
  epub_url?: string;
  download_count: number;
}

export interface CatalogSearchResponse {
  count: number;
  page: number;
  has_next: boolean;
  results: CatalogBookItem[];
}

export interface CatalogSearchParams {
  search?: string;
  language?: string;
  topic?: string;
  page?: number;
}
