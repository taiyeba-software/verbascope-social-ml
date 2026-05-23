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
			maxlength: 1000,
		},
		image: {
			type: String,
			default: '',
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