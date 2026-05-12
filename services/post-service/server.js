import app from './src/app.js';
import connectDB from './src/db/db.js';
import { connect } from './src/broker/rabbit.js';

const isDbConnected = await connectDB();
try {
    await connect();
} catch (err) {
    console.warn('⚠️  RabbitMQ unavailable, continuing without it.');
}

app.listen(3003, () => {
    if (!isDbConnected) {
        console.warn('⚠️  Post service started without MongoDB.');
    }
    console.log('Post service running on port 3003');
});