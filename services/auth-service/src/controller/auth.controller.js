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
            sameSite: 'lax',
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
            sameSite: 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000,
        });

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            message: 'Google login successful',
            user: userData,
        });
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
            sameSite: 'lax',
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

        const userData = user.toObject();
        delete userData.password;

        return res.status(200).json({
            success: true,
            message: 'Google login successful',
            user: userData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const authController = { register, googleCallback };
export default authController;