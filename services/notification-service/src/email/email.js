import nodemailer from 'nodemailer';
import config from '../config/config.js';

// ─── Transporter ────────────────────────────────────────────────
// createTransport connects our app (web server) to Gmail's
// SMTP server using OAuth2 instead of a plain password.
// OAuth2 is required by Google for production sending.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type:         'OAuth2',
        user:         config.EMAIL_USER,
        clientId:     config.CLIENT_ID,
        clientSecret: config.CLIENT_SECRET,
        refreshToken: config.REFRESH_TOKEN,
        accessToken:  config.ACCESS_TOKEN,
    },
});

// ─── Verify ─────────────────────────────────────────────────────
// Checks whether the SMTP connection to Gmail is alive and
// the OAuth2 credentials are accepted before any email is sent.
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email server connection failed:', error.message);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// ─── sendEmail ──────────────────────────────────────────────────
/**
 * Sends an email from VerbaScope's official address.
 *
 * @param {string} to      - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} text    - Plain-text fallback body
 * @param {string} html    - HTML body (shown in modern email clients)
 */
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from:    `"VerbaScope" <${config.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log('📧 Message sent:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        throw error; // re-throw so the caller can handle it
    }
};

export default sendEmail;