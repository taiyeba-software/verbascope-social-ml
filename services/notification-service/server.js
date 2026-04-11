

import 'dotenv/config';
import app from './src/app.js';
import { connect } from './src/broker/rabbit.js';      // ← add
import startListener from './src/broker/listener.js';  // ← add

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Connect to RabbitMQ then start listening for events
await connect();
startListener();

app.listen(PORT, () => {
    console.log(`Notification service running on ${BASE_URL}`);
    console.log(`Test endpoint: ${BASE_URL}/api/notification/test-email`);
});