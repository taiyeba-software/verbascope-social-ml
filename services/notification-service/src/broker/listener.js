import { subscribeToQueue } from './rabbit.js';
import sendEmail from '../email/email.js';

const startListener = () => {
    subscribeToQueue('user_created', async (msg) => {
        const { email, role, fullname: { firstName, lastName } } = msg;

        const template = `
            <h2>Welcome to VerbaScope 🎉</h2>
            <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
            <p>Thank you for registering with <strong>VerbaScope</strong>.
            We are excited to have you on board!</p>
            <p>Your role is: <strong>${role}</strong></p>
            <p>We hope you enjoy our services.</p>
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

    console.log('👂 Listening on queue: user_created');
};

export default startListener;