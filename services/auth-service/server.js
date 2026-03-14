//import app from express
import app from './src/app.js';
//import connectdb dunction
import connectDB from './src/db/db.js';
import authRoutes from './src/routes/auth.routes.js';

//call connectDB function to connect to the database
const isDbConnected = await connectDB();

//register auth routes
app.use('/api/auth', authRoutes);

//server port
app.listen(3000, () => {
    if (!isDbConnected) {
        console.warn('Auth service started without MongoDB connection. Check Atlas IP whitelist and MONGO_URI.');
    }
    console.log('Auth service is running on port 3000');
});   