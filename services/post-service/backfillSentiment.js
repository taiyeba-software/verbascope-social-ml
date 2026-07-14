/**
 * backfillSentiment.js
 * ---------------------------------------------------------------------------
 * One-time script. Run once, then delete (or keep around if you ever add a
 * bulk re-classification admin action — but it's not part of the app's
 * normal runtime).
 *
 * Path: services/post-service/backfillSentiment.js
 * Run from the post-service root:
 *   node backfillSentiment.js
 *
 * Why this is needed: sentiment is computed ONCE, at write time, inside
 * addComment (see comment.controller.js) — same denormalization pattern as
 * repliesCount. Comments created before that logic existed never got
 * classified, so they're stuck on the schema default { neutral, 0 }. This
 * script runs classifyComment() over every existing comment and saves the
 * result, one time, to catch them up.
 * ---------------------------------------------------------------------------
 */

import mongoose from 'mongoose';
import config from './src/config/config.js';
import Comment from './src/models/comment.model.js';
import { classifyComment } from './src/services/commentSentiment.js';

async function run() {
	await mongoose.connect(config.MONGO_URI);
	console.log('MongoDB connected');

	const comments = await Comment.find({});
	console.log(`Found ${comments.length} comments to reclassify.`);

	let updated = 0;
	for (const comment of comments) {
		const sentiment = await classifyComment(comment.content);
		comment.sentiment = sentiment;
		await comment.save();
		updated++;
		console.log(`[${updated}/${comments.length}] "${comment.content.slice(0, 40)}" -> ${sentiment.label} (${sentiment.score})`);
	}

	console.log(`Done. Reclassified ${updated} comments.`);
	await mongoose.disconnect();
	process.exit(0);
}

run().catch((err) => {
	console.error('Backfill failed:', err);
	process.exit(1);
});