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

    
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

   
    interests: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

const userModel = mongoose.model('User', userSchema); // ← capital "U" now
export default userModel;
