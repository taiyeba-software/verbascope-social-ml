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
      // ── NEW: ML Brain "v2" fields ──
      // language / languageConfidence are the ML Brain's own language
      // detection on the analyzed text. Deliberately named differently
      // from the top-level `contentLanguage` field above (which is set
      // synchronously at createPost time via detectLanguage.js) so the
      // two never collide or get confused — contentLanguage is "our
      // quick guess at write time", this is "the ML Brain's verdict
      // after analysis".
      language: {
        type: String,
        default: null,
      },
      languageConfidence: {
        type: Number,
        default: null,
      },
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
      // ── NEW: human-readable toxicity bucket from ML Brain v2 (e.g. "low"/"medium"/"high") ──
      toxicityLevel: {
        type: String,
        default: null,
      },
      riskFlag: {
        type: String,
        enum: ['green', 'yellow', 'red', null],
        default: null,
      },
      // ── NEW: ML Brain's own free-text explanation for the risk flag ──
      explanation: {
        type: String,
        default: null,
      },
      // ── NEW: single 0–1 "how sure is the model" number from ML Brain
      // (rabbit_consumer.py's result.confidence -> handleMLResult() in
      // post.controller.js). Without this field declared here, Mongoose
      // silently drops mlAnalysis.confidence from every $set — it never
      // reaches the database even though the controller sets it
      // correctly. Feeds the "Confidence" row in the frontend's
      // expandable AI Analysis card.
      confidence: {
        type: Number,
        default: null,
      },
      // Derived from riskFlag via signalMapper.js's getAISignal().
      // These are what the frontend renders by default (the feed card);
      // the raw fields above stay available for the
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
    // ── NEW: Pulse feature ──
    // Set once at createPost time (see post.controller.js): the first
    // hashtag on the post, lowercased, no '#'. Falls back to 'general'
    // when a post has no tags. Deliberately dumb/deterministic — no
    // NLP, no re-classification later — so getWeeklyPulse() in
    // pulse.js can group posts by this field directly in a Mongo
    // aggregation without touching the ML pipeline at all.
    pulseTopic: {
      type: String,
      default: 'general',
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
postSchema.index({ pulseTopic: 1, createdAt: -1 });        // ── NEW: for getWeeklyPulse() aggregation
postSchema.index(                                          // text index with fixed language
  { normalizedContent: 'text', content: 'text' },
  { default_language: 'none' }                            // 'none' = language-agnostic, supports Bangla
);

export default mongoose.model('Post', postSchema);