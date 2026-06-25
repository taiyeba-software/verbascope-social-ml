import app from './src/app.js';
import connectDB from './src/db/db.js';
import authRoutes from './src/routes/auth.routes.js';
import { connect } from './src/broker/rabbit.js';  // ← add this
import userRoutes from './src/routes/user.routes.js';

const isDbConnected = await connectDB();
await connect();  // ← connect to RabbitMQ on startup

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes); 

app.listen(3000, () => {
    if (!isDbConnected) {
        console.warn('⚠️  Auth service started without MongoDB.');
    }
    console.log('Auth service running on port 3000');
});