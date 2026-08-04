import type { SearchResponse } from '@/types/search';

/* NOTE: your notificationService already talks to the backend via
   `@/lib/api` (axios, auth token attached automatically — see how
   notificationService.getNotifications() is called with no explicit token
   in Navbar.tsx). If that file exports a shared axios instance, prefer
   wiring this function through it instead, e.g.:

     import api from '@/lib/api';
     export async function searchPosts(query, { limit = 6, offset = 0 } = {}) {
       const res = await api.get('/api/posts/search', { params: { q: query, limit, offset } });
       return res.data;
     }

   The version below is self-contained (plain fetch) so it works regardless
   of what that file looks like — swap it in once you confirm the shape. */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export interface SearchPostsOptions {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/**
 * searchPosts — the ONE function that talks to GET /api/posts/search.
 * Nothing else in the app should build this URL or call fetch/axios for search.
 */
export async function searchPosts(
  query: string,
  { limit = 6, offset = 0, signal }: SearchPostsOptions = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  });

  const token = getAuthToken();

  const res = await fetch(`${API_BASE_URL}/api/posts/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });

  if (!res.ok) {
    throw new Error(`Search request failed with status ${res.status}`);
  }

  return res.json();
}
