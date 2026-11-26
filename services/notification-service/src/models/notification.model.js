import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        actorName: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            // CHANGED: added 'reply' (and 'pass_forward', which listener.js
            // already references) so these types no longer fail validation.
            enum: ['like', 'comment', 'reply', 'share', 'pass_forward'],
            required: true,
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        reason: {
            type: String,
            default: null, // only for pass_forward
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);