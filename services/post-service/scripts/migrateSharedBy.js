import mongoose from 'mongoose';
import Post from '../src/models/post.model.js';

const MONGO_URI = process.env.MONGO_URI; // adjust to however you already connect

async function migrate() {
  await mongoose.connect(MONGO_URI);

  const posts = await Post.find({ 'sharedBy.0': { $exists: true } }).select('sharedBy');
  let changed = 0;

  for (const post of posts) {
    let needsUpdate = false;
    const migrated = post.sharedBy.map((entry) => {
      // Already migrated (has .user) — leave as-is.
      if (entry && typeof entry === 'object' && entry.user) return entry;
      needsUpdate = true;
      return { user: entry, reason: null, sharedAt: post.createdAt || new Date() };
    });

    if (needsUpdate) {
      await Post.updateOne({ _id: post._id }, { $set: { sharedBy: migrated } });
      changed++;
    }
  }

  console.log(`Migrated ${changed} of ${posts.length} post(s) with shares.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});