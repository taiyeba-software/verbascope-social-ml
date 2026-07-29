import { subscribeToQueue } from './rabbit.js';
import sendEmail from '../email/email.js';
import Notification from '../models/notification.model.js';
import { io } from '../../server.js';

// ─── Notification Message Builder ──────────────────────────────────────────
const buildMessage = (type, actorName, reason) => {
    if (type === 'like')         return `❤️ ${actorName} liked your post.`;
    if (type === 'comment')      return `💬 ${actorName} commented on your post.`;
    if (type === 'pass_forward') return reason
        ? `✨ ${actorName} passed your post forward as "${reason}".`
        : `✨ ${actorName} passed your post forward.`;
    return 'You have a new notification.';
};

// ─── Google OAuth Email Template Helper ────────────────────────────────────
const buildGoogleEmailTemplate = (fullname, email) => {
    const formattedDate = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; color: #202124;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1a73e8; margin-bottom: 4px; font-size: 22px;">VerbaScope</h2>
                <p style="font-size: 14px; color: #5f6368; margin: 0;">Keep track of your Google Account data</p>
            </div>

            <p style="font-size: 15px;">Hi <strong>${fullname}</strong>,</p>

            <div style="background-color: #e8f0fe; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 14px; color: #1967d2; line-height: 1.5;">
                ℹ️ You're receiving this email because you used Sign in with Google to sign in to <strong>VerbaScope</strong> on <strong>${formattedDate}</strong>.
            </div>

            <p style="font-size: 14px; color: #3c4043; margin-bottom: 8px;">
                <strong>VerbaScope received this profile info:</strong>
            </p>

            <div style="background-color: #f8f9fa; border: 1px solid #f1f3f4; border-radius: 8px; padding: 12px 16px; font-size: 13px; line-height: 1.6; color: #3c4043;">
                👤 <strong>${fullname}</strong><br/>
                <span style="color: #5f6368;">Name and profile picture</span><br/><br/>
                ✉️ <strong>${email}</strong><br/>
                <span style="color: #5f6368;">Email address</span>
            </div>

            <p style="font-size: 12px; color: #70757a; margin-top: 24px; line-height: 1.4;">
                This email summarizes the info that you shared. There's nothing that you need to do right now.
            </p>
        </div>
    `;
};

// ─── Standard Welcome Email Template Helper ────────────────────────────────
const buildStandardWelcomeTemplate = (fullname, role) => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; color: #333;">
            <h2 style="color: #2e7d32; margin-top: 0;">Welcome to VerbaScope 🎉</h2>
            <p>Dear <strong>${fullname}</strong>,</p>
            <p>Thank you for registering with <strong>VerbaScope</strong>. We are excited to have you on board!</p>
            <p>Your account role: <strong>${role || 'Member'}</strong></p>
            <br/>
            <p style="margin-bottom: 0;">Best regards,<br/><strong>The VerbaScope Team</strong></p>
        </div>
    `;
};

// ─── Main Queue Listener ───────────────────────────────────────────────────
const startListener = () => {

    // ── Queue 1: User Registration / Login Email Events ────────────────────
    subscribeToQueue('user_created', async (msg) => {
        try {
            const { email, role, fullname, authProvider } = msg;

            if (!email) {
                console.warn('⚠️ Received user_created message without an email address.');
                return;
            }

            // Safely resolve fullname whether it's an object { firstName, lastName } or string
            let name = 'User';
            if (typeof fullname === 'object' && fullname !== null) {
                name = `${fullname.firstName || ''} ${fullname.lastName || ''}`.trim() || 'User';
            } else if (typeof fullname === 'string' && fullname.trim() !== '') {
                name = fullname.trim();
            }

            // Branch based on sign-in provider
            if (authProvider === 'google') {
                const subject = 'You shared some Google Account data with VerbaScope';
                const template = buildGoogleEmailTemplate(name, email);
                const plainText = `You signed in to VerbaScope using Google on ${new Date().toLocaleDateString()}.`;

                await sendEmail(email, subject, plainText, template);
            } else {
                const subject = 'Welcome to VerbaScope';
                const template = buildStandardWelcomeTemplate(name, role);
                const plainText = `Thank you for registering with VerbaScope, ${name}!`;

                await sendEmail(email, subject, plainText, template);
            }
        } catch (err) {
            console.error('❌ Failed to process user_created email message:', err.message);
        }
    });

    // ── Queue 2: Real-time In-App Notifications ────────────────────────────
    subscribeToQueue('notification_created', async (msg) => {
        try {
            const { recipientId, actorId, actorName, type, postId, reason } = msg;

            // Don't send notification to yourself
            if (recipientId?.toString() === actorId?.toString()) return;

            const message = buildMessage(type, actorName, reason);

            // Save notification to MongoDB
            const notification = await Notification.create({
                recipientId,
                actorId,
                actorName,
                type,
                postId,
                reason: reason || null,
                message,
            });

            // Emit live WebSocket notification directly to recipient room
            io.to(recipientId.toString()).emit('notification:new', notification);
        } catch (err) {
            console.error('❌ Failed to process notification_created message:', err.message);
        }
    });

    console.log('👂 Listening on queues: user_created, notification_created');
};

export default startListener;