import 'dotenv/config';           
// ← added this as the very first line so import dotenv in server.js so process.env.PORT is available from your .env file before anything else runs:
import app from './src/app.js';

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

app.listen(PORT, () => {
    console.log(`Notification service running on ${BASE_URL}`);
    console.log(`Test email endpoint: ${BASE_URL}/api/notification/test-email`);
});