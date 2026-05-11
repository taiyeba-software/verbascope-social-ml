import app from './src/app.js';
import connectDB from './src/db/db.js';
import authRoutes from './src/routes/auth.routes.js';
import { connect } from './src/broker/rabbit.js';  // ← add this

const isDbConnected = await connectDB();
await connect();  // ← connect to RabbitMQ on startup

app.use('/api/auth', authRoutes);

app.listen(3003, () => {
    if (!isDbConnected) {
        console.warn('⚠️  Post service started without MongoDB.');
    }
    console.log('Post service running on port 3003');
});