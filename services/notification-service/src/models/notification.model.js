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
            enum: ['like', 'comment', 'pass_forward'],
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