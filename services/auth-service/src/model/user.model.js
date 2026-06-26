import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    fullname: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
    },
    password: {
      type: String,
      required: function () {
        return !this.googleID;
      },
    },
    googleID: { type: String },
    role: { type: String, default: 'user' },

    // ── Profile ──────────────────────────────────────────
    bio: { type: String, default: '' },
    headline: { type: String, default: '' },
    avatar: { type: String, default: '' },

    // ── Social graph ─────────────────────────────────────
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],

    // ── Behavioral interest vector (built by post-service via RabbitMQ) ──
    interests: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

const userModel = mongoose.model('user', userSchema);
export default userModel;
