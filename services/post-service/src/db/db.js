//import mongoose and app config
import mongoose from 'mongoose';
import config from '../config/config.js';

//async function to connect to the database
const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('MongoDB connected');
        return true;
        
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        return false;
    }
};

export default connectDB;