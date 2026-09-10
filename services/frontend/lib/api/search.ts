import type { SearchResponse, TagSearchResponse, TagPostsResponse } from '@/types/search';
import { tokenStorage } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

// Same auth strategy as postService (lib/api.ts): post-service lives on a
// different onrender.com subdomain, so the httpOnly cookie never reaches it
// cross-origin. These plain fetch() calls were still relying on the cookie
// alone, which is why /search/tags (and friends) 401'd with "No token
// found" while axios-based postService.search() worked fine.
function authHeaders(): HeadersInit {
  const token = tokenStorage.get();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface SearchPostsOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function searchPosts(
  query: string,
  { limit = 6, offset = 0, signal }: SearchPostsOptions = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  });

  const res = await fetch(`${API_BASE_URL}/api/posts/search?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    signal,
  });

  if (!res.ok) {
    throw new Error(`Search request failed with status ${res.status}`);
  }

  return res.json();
}

// ── Tag search ──

export interface SearchTagsOptions {
  limit?: number;
  signal?: AbortSignal;
}

export async function searchTags(
  query: string,
  { limit = 6, signal }: SearchTagsOptions = {}
): Promise<TagSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });

  const res = await fetch(`${API_BASE_URL}/api/posts/search/tags?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    signal,
  });

  if (!res.ok) {
    throw new Error(`Tag search request failed with status ${res.status}`);
  }

  return res.json();
}

export interface GetPostsByTagOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

export async function getPostsByTag(
  tagName: string,
  { limit = 20, offset = 0, signal }: GetPostsByTagOptions = {}
): Promise<TagPostsResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  const res = await fetch(
    `${API_BASE_URL}/api/posts/tag/${encodeURIComponent(tagName)}?${params.toString()}`,
    {
      method: 'GET',
      headers: authHeaders(),
      credentials: 'include',
      signal,
    }
  );

  if (!res.ok) {
    throw new Error(`Tag posts request failed with status ${res.status}`);
  }

  return res.json();
}