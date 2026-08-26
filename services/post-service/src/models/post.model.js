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
    normalizedContent: {
      type: String,
      default: '',
    },
    contentLanguage: {          // renamed from 'language' — avoids MongoDB text index conflict
      type: String,
      enum: ['en', 'bn', 'mixed'],
      default: 'mixed',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    mlAnalysis: {
      sentiment: {
        type: String,
        default: null,
      },
      sarcasm: {
        type: Boolean,
        default: null,
      },
      sarcasmProbability: {
        type: Number,
        default: null,
      },
      toxicity: {
        type: Number,
        default: null,
      },
      riskFlag: {
        type: String,
        enum: ['green', 'yellow', 'red', null],
        default: null,
      },
      // ── NEW: VerbaScope AI Signal feature ──
      // Derived from riskFlag via signalMapper.js's getAISignal().
      // These are what the frontend renders by default (the feed card);
      // sentiment/sarcasm/toxicity above stay available for the
      // "Why this signal?" expandable detail view.
      signal: {
        type: String,
        default: null,
      },
      signalMessage: {
        type: String,
        default: null,
      },
      analyzedAt: {
        type: Date,
        default: null,
      },
    },
    tags: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 4,
        message: 'A post can have at most 4 images.',
      },
    },
    likesCount:    { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount:   { type: Number, default: 0 },
    sharedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    shareReasons: {
      agree:           { type: Number, default: 0 },
      funny:           { type: Number, default: 0 },
      needs_attention: { type: Number, default: 0 },
      insightful:      { type: Number, default: 0 },
      concerning:      { type: Number, default: 0 },
      educational:     { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ contentLanguage: 1, createdAt: -1 });  // renamed
postSchema.index({ tags: 1 });
postSchema.index(                                          // text index with fixed language
  { normalizedContent: 'text', content: 'text' },
  { default_language: 'none' }                            // 'none' = language-agnostic, supports Bangla
);

export default mongoose.model('Post', postSchema);