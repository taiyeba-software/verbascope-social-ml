/* Matches the flat document shape actually sent to Meilisearch
   (`toSearchDoc()` in postIndex.js) — NOT a nested author object.
   authorAvatar was added alongside authorName/authorId — the search
   index now carries the same ImageKit URL (or null) that PostCard and
   CreatePostBox already render elsewhere in the app. */
export interface SearchPost {
  _id: string;
  content: string;
  normalizedContent?: string;
  tags?: string[];
  authorId: string;
  authorName: string;
  authorAvatar: string | null; // ImageKit URL, or null if the user has no avatar
  contentLanguage?: string;
  wordCount?: number;
  imagesCount?: number;
  createdAt: number; // epoch ms — Meilisearch has no native Date type
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