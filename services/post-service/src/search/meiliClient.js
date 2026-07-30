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