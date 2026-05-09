/*import userModel from '../model/user.model.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/config.js';

const register = async (req, res) => {
    try {
        const { email, password, fullname } = req.body;

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await userModel.create({
            email,
            password: hashedPassword,
            fullname: {
                firstName: fullname?.firstName,
                lastName: fullname?.lastName,
            },
        });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '2d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            // In production (HTTPS) we want secure + SameSite=None for cross-site OAuth
            // In development over HTTP, enable insecure but usable cookie behaviour
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const googleCallback = async (req, res) => {
    try {
        const user = req.user;

        const token = jwt.sign(
            { id: user._id, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '2d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        // After successful Google OAuth, redirect back to frontend
        // Use CLIENT_URL environment variable with a sensible fallback
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3002';
        // set a short-lived redirect to the feed (frontend will read cookie)
        return res.redirect(`${clientUrl}/feed`);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const authController = {
    register,
    googleCallback,
};

export default authController;
*/
import userModel from '../model/user.model.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/config.js';
import { publishToQueue } from '../broker/rabbit.js';  // ← add this

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
            });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '2d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists.',
            });
        }

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const register = async (req, res) => {
    try {
        const { email, password, fullname } = req.body;

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await userModel.create({
            email,
            password: hashedPassword,
            fullname: {
                firstName: fullname?.firstName,
                lastName:  fullname?.lastName,
            },
        });

        const token = jwt.sign(
            { id: user._id, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '2d' }
        );

        // ── publish to queue after JWT is signed ─────────────────
        await publishToQueue('user_created', {
            id:       user._id,
            email:    user.email,
            fullname: user.fullname,
            role:     user.role,
        });
        // ─────────────────────────────────────────────────────────

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const googleCallback = async (req, res) => {
    try {
        const user = req.user;

        const token = jwt.sign(
            { id: user._id, role: user.role },
            config.JWT_SECRET,
            { expiresIn: '2d' }
        );

        // ── publish to queue for Google OAuth registrations too ──
        await publishToQueue('user_created', {
            id:       user._id,
            email:    user.email,
            fullname: user.fullname,
            role:     user.role,
        });
        // ─────────────────────────────────────────────────────────

        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3002';
        return res.redirect(`${clientUrl}/feed`);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const authController = { register, login, googleCallback, getMe };
export default authController;