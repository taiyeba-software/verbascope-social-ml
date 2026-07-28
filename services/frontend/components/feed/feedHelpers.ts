import type { Post } from '@/types';

export type Comment = {
  _id: string;
  content: string;
  author?: { fullname?: { firstName?: string; lastName?: string }; avatar?: string } | string | null;
  createdAt?: string;
};



export function safeAuthorName(author: Post['author'] | Comment['author']): string {
  if (!author) return 'Anonymous';
  if (typeof author === 'string') return author || 'Anonymous';
  const fn = author?.fullname?.firstName ?? '';
  const ln = author?.fullname?.lastName ?? '';
  return `${fn} ${ln}`.trim() || 'Anonymous';
}

export function safeAuthorInitials(author: Post['author'] | Comment['author']): string {
  if (!author) return 'A';
  if (typeof author === 'string') return (author[0] ?? 'A').toUpperCase();
  const f = author?.fullname?.firstName?.[0] ?? '';
  const l = author?.fullname?.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || 'A';
}

// Posts/comments coming back from the API have an `avatar` field on the
// author object once the user has uploaded a profile photo — but it can
// also be `undefined` (never set) or `""` (explicitly cleared / user with
// no avatar yet), so both need to fall through to the initials avatar
// rather than rendering a broken <img src="">.
export function getAuthorAvatarUrl(author: Post['author'] | Comment['author']): string | undefined {
  if (!author || typeof author === 'string') return undefined;
  const avatar = (author as { avatar?: string }).avatar;
  return avatar && avatar.trim() !== '' ? avatar : undefined;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #0e9fab, #17b0bc)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'linear-gradient(135deg, #f97316, #fb923c)',
  'linear-gradient(135deg, #ef4444, #f87171)',
  'linear-gradient(135deg, #22c55e, #4ade80)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
  'linear-gradient(135deg, #eab308, #facc15)',
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getAvatarSeed(author: Post['author'] | Comment['author']): string {
  if (!author) return 'anonymous';
  if (typeof author === 'string') return author;
  return (
    (author as { id?: string }).id ||
    `${author.fullname?.firstName ?? ''} ${author.fullname?.lastName ?? ''}`.trim() ||
    'anonymous'
  );
}

export function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function extractTags(content: string): string[] {
  return (content.match(/#\w+/g) ?? []).slice(0, 4);
}