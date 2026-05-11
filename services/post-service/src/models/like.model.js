import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
		},
		post: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Post',
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

// Prevent a user from liking the same post twice
likeSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model('Like', likeSchema);