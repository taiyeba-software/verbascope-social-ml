export interface SearchPost {
  _id: string;
  content: string;
  normalizedContent?: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  contentLanguage?: string;
  wordCount?: number;
  imagesCount?: number;
  createdAt: number;
}

export interface SearchResponse {
  success: boolean;
  query: string;
  total: number;
  limit: number;
  offset: number;
  processingTimeMs?: number;
  results: SearchPost[];
}

// ── NEW: Tag search ──
export interface SearchTag {
  tag: string;
  postsCount: number;
}

export interface TagSearchResponse {
  success: boolean;
  query: string;
  results: SearchTag[];
}

export interface TagPostsResponse {
  success: boolean;
  tag: string;
  total: number;
  limit: number;
  offset: number;
  // Meilisearch-shaped results (same flat shape as SearchPost), NOT the
  // full Mongo post — no likedByMe/bookmarkedByMe/images[] here yet.
  results: SearchPost[];
}