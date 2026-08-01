// One-off backfill: rebuilds the "posts" Meilisearch index from Mongo.
// Run with: node src/scripts/reindexPosts.js
//
// Safe to re-run any time — indexPost() upserts, it never duplicates.

// MUST be the first import: ES modules hoist all imports above any code
// in the file body, so if authClient.js reads process.env at import time
// (e.g. to build its axios baseURL) and dotenv.config() runs later in
// this file, authClient sees undefined env vars and builds a relative
// URL — which is exactly the "Invalid URL: /api/users/bulk" error.
import 'dotenv/config';

import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import authClient from '../utils/authClient.js';
import { indexPost } from '../search/postIndex.js';
import { initMeilisearch } from '../search/meiliClient.js';

const BATCH_SIZE = 100;

async function reindexAll() {
  // NOTE: adjust this if post-service already has a shared connectDB()
  // helper (e.g. in src/config/db.js) — reuse that instead of connecting
  // directly here, so both paths stay in sync.
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Mongo connected');

  const ready = await initMeilisearch();
  if (!ready) {
    console.error('❌ Meilisearch unavailable — aborting reindex.');
    process.exit(1);
  }

  const total = await Post.countDocuments();
  console.log(`Found ${total} posts to reindex.`);

  let processed = 0;
  let skip = 0;

  while (skip < total) {
    const posts = await Post.find().sort({ _id: 1 }).skip(skip).limit(BATCH_SIZE).lean();
    if (posts.length === 0) break;

    const authorIds = [...new Set(posts.map((p) => p.author.toString()))];
    const usersRes = await authClient.post('/api/users/bulk', { ids: authorIds });
    const userMap = Object.fromEntries(
      (usersRes.data.users || []).map((u) => [u._id.toString(), u])
    );

    await Promise.all(
      posts.map((post) => indexPost(post, userMap[post.author.toString()] || null))
    );

    processed += posts.length;
    skip += BATCH_SIZE;
    console.log(`Indexed ${processed}/${total}`);
  }

  console.log('✅ Reindex complete.');
  await mongoose.disconnect();
  process.exit(0);
}

reindexAll().catch((err) => {
  console.error('❌ Reindex failed:', err);
  process.exit(1);
});