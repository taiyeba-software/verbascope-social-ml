import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
	{
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		content: {
			type: String,
			trim: true,
			maxlength: 3000,
		},
		images: {
			type: [String],
			default: [],
			validate: {
				validator: (arr) => arr.length <= 4,
				message: 'A post can have at most 4 images.',
			},
		},
		likesCount: {
			type: Number,
			default: 0,
		},
		commentsCount: {
			type: Number,
			default: 0,
		},
		sharesCount: {
			type: Number,
			default: 0,
		},
		sharedBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
		],
		shareReasons: {
			agree: {
				type: Number,
				default: 0,
			},
			funny: {
				type: Number,
				default: 0,
			},
			needs_attention: {
				type: Number,
				default: 0,
			},
			insightful: {
				type: Number,
				default: 0,
			},
			concerning: {
				type: Number,
				default: 0,
			},
			educational: {
				type: Number,
				default: 0,
			},
		},
		likedBy: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'User',
			},
		],
	},
	{
		timestamps: true,
	}
);

// Indexes for feed performance and user profile queries
postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

export default mongoose.model('Post', postSchema);