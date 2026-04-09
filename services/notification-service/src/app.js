import express from 'express';
import morgan from 'morgan';
import sendEmail from './email/email.js';

const app = express();

app.use(morgan('dev'));
app.use(express.json());

// no cookieParser — notification service doesn't deal with cookies

app.post('/api/notification/test-email', async (req, res) => {
    const { to, subject } = req.body;
    try {
        await sendEmail(
            to || 'islamtaiyeba38@gmail.com',
            subject || 'VerbaScope Test Email',
            'This is a plain text test from VerbaScope notification service.',
            `<p>Hello from <b>VerbaScope</b>! Your notification service is working. 🎉</p>`
        );
        return res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

export default app;