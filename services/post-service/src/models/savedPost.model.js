import mongoose from 'mongoose';

const savedPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// A user can only save a given post once, and this index also makes
// "is this post saved by this user" lookups fast.
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model('SavedPost', savedPostSchema);