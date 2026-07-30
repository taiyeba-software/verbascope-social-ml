import { meiliClient } from './meiliClient.js';

export async function getSearchHealth() {
  try {
    const health = await meiliClient.health();
    return {
      status: 'ok',
      meilisearch: health.status,
    };
  } catch (err) {
    return {
      status: 'error',
      meilisearch: 'unreachable',
      error: err.message,
    };
  }
}