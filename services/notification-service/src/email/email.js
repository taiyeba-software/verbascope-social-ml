import nodemailer from 'nodemailer';
import config from '../config/config.js';

// ─── Transporter ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
    },
});

// ─── Verify Connection ─────────────────────────────────────────
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email server connection failed:', error.message);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

// ─── sendEmail Function ────────────────────────────────────────
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"VerbaScope" <${config.EMAIL_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log('📧 Message sent to', to, '| ID:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        throw error;
    }
};

// Ensure default export is present so app.js and listener.js work seamlessly
export default sendEmail;