import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		post: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Post',
			required: true,
		},
		// ── NEW: self-referencing parent — null means top-level comment ──
		parentComment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Comment',
			default: null,
		},
		// ── NEW: denormalized count, avoids a COUNT query per comment ──
		repliesCount: {
			type: Number,
			default: 0,
		},
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
		// ── Milestone 3: denormalized sentiment, computed once at write time
		// by commentSentiment.classifyComment() and never recomputed on read.
		// Same reasoning as repliesCount above. ──
		sentiment: {
			label: {
				type: String,
				enum: ['positive', 'negative', 'neutral'],
				default: 'neutral',
			},
			score: {
				type: Number,
				default: 0,
			},
		},
	},
	{
		timestamps: true,
	}
);

// Speeds up "get top-level comments for a post" and "get replies to a comment"
commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });

export default mongoose.model('Comment', commentSchema);