import mongoose from 'mongoose';

// Stores per-user behavioral interest scores derived from engagement.
// Lives in post-service so it can be updated inline with like/comment/share.
const userPulseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    // Map of hashtag → score  e.g. { ai: 12, philosophy: 8 }
    interests: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model('UserPulse', userPulseSchema);