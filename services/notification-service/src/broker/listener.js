import { subscribeToQueue } from './rabbit.js';
import sendEmail from '../email/email.js';
import Notification from '../models/notification.model.js';
import { io } from '../../server.js';

const buildMessage = (type, actorName, reason) => {
    if (type === 'like')         return `❤️ ${actorName} liked your post.`;
    if (type === 'comment')      return `💬 ${actorName} commented on your post.`;
    if (type === 'pass_forward') return reason
        ? `✨ ${actorName} passed your post forward as "${reason}".`
        : `✨ ${actorName} passed your post forward.`;
    return 'You have a new notification.';
};

const startListener = () => {

    // ── existing: welcome email on registration ───────────────────
    subscribeToQueue('user_created', async (msg) => {
        const { email, role, fullname: { firstName, lastName } } = msg;
        const template = `
            <h2>Welcome to VerbaScope 🎉</h2>
            <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
            <p>Thank you for registering with <strong>VerbaScope</strong>.
            We are excited to have you on board!</p>
            <p>Your role is: <strong>${role}</strong></p>
            <br/>
            <p>Best regards,<br/>The VerbaScope Team</p>
        `;
        await sendEmail(
            email,
            'Welcome to VerbaScope',
            `Thank you for registering with VerbaScope.`,
            template
        );
    });

    // ── new: in-app notifications ─────────────────────────────────
    subscribeToQueue('notification_created', async (msg) => {
        const { recipientId, actorId, actorName, type, postId, reason } = msg;

        // don't notify yourself
        if (recipientId?.toString() === actorId?.toString()) return;

        const message = buildMessage(type, actorName, reason);

        // save to MongoDB
        const notification = await Notification.create({
            recipientId,
            actorId,
            actorName,
            type,
            postId,
            reason: reason || null,
            message,
        });

        // emit only to the recipient's socket room
        io.to(recipientId.toString()).emit('notification:new', notification);
    });

    console.log('👂 Listening on queues: user_created, notification_created');
};

export default startListener;