import { Meilisearch } from 'meilisearch';

export const meiliClient = new Meilisearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'dev_master_key_change_me',
});

const POSTS_INDEX = 'posts';

async function ensurePostsIndex() {
  try {
    await meiliClient.getIndex(POSTS_INDEX);
  } catch (err) {
    const code = err.code || err.cause?.code || err.errorCode;
    if (code === 'index_not_found') {
      await meiliClient.createIndex(POSTS_INDEX, { primaryKey: '_id' });
      console.log(`✅ Created "${POSTS_INDEX}" index`);
    } else {
      throw err;
    }
  }
}

export async function initMeilisearch() {
  // ── TEMP DIAGNOSTIC: bypass the meilisearch client entirely, using
  // raw fetch, to see exactly what post-service's own network gets back
  // from MEILI_HOST — removes this file's client library as a variable.
  try {
    const raw = await fetch(`${process.env.MEILI_HOST}/health`, {
      headers: { Authorization: `Bearer ${process.env.MEILI_MASTER_KEY}` },
    });
    const text = await raw.text();
    console.log('🔍 [MEILI DIAGNOSTIC] status:', raw.status);
    console.log('🔍 [MEILI DIAGNOSTIC] body:', text.slice(0, 300));
  } catch (err) {
    console.log('🔍 [MEILI DIAGNOSTIC] fetch itself threw:', err.message);
  }

  try {
    await meiliClient.health();
    console.log('✅ Meilisearch connected');
    await ensurePostsIndex();
    return true;
  } catch (err) {
    console.warn('⚠️ Meilisearch unavailable — search disabled.');
    console.warn(err.message);
    return false;
  }
}


export function postsIndex() {
  return meiliClient.index(POSTS_INDEX);
}