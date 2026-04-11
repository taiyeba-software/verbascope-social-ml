import app from './src/app.js';
import connectDB from './src/db/db.js';
import authRoutes from './src/routes/auth.routes.js';
import { connect } from './src/broker/rabbit.js';  // ← add this

const isDbConnected = await connectDB();
await connect();  // ← connect to RabbitMQ on startup

app.use('/api/auth', authRoutes);

app.listen(3000, () => {
    if (!isDbConnected) {
        console.warn('⚠️  Auth service started without MongoDB.');
    }
    console.log('Auth service running on port 3000');
});