import mongoose from 'mongoose';
import { VALID_REASONS } from '../constants/shareReasons.js';

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
      toxicityLevel: {
        type: String,
        default: null,
      },
      riskFlag: {
        type: String,
        enum: ['green', 'yellow', 'red', null],
        default: null,
      },
      explanation: {
        type: String,
        default: null,
      },
      confidence: {
        type: Number,
        default: null,
      },
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

    // ── UPDATED: Community Insights — "who marked it" ──
    // Was: [{ type: ObjectId, ref: 'User' }] — just a flat list of sharers,
    // with no record of which reason each person picked. That made it
    // impossible to (a) show who marked a post as e.g. "Insightful" and
    // (b) correctly reverse shareReasons.<reason> on unshare (see the
    // "Known limitations" note this replaces).
    //
    // NOTE ON EXISTING DATA: documents created before this change still
    // have sharedBy as raw ObjectIds in the database. Mongoose casts new
    // $push'd entries into this subdocument shape going forward, but a
    // .lean() read of an OLD document returns those old entries as plain
    // ObjectIds, not { user, reason, sharedAt } objects. Every place that
    // reads sharedBy (sharePost, unsharePost, addStateFlags, getPostSharers)
    // MUST handle both shapes — look for `(entry.user ?? entry)`. Run the
    // one-time migration script (scripts/migrateSharedBy.js) to normalize
    // existing documents so this fallback becomes unnecessary over time.
    sharedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      reason: {
        type: String,
        enum: [...VALID_REASONS, null],
        default: null,
      },
      sharedAt: {
        type: Date,
        default: Date.now,
      },
    }],

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
postSchema.index({ contentLanguage: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ pulseTopic: 1, createdAt: -1 });
postSchema.index(
  { normalizedContent: 'text', content: 'text' },
  { default_language: 'none' }
);

export default mongoose.model('Post', postSchema);