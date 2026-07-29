import express from 'express';
import passport from 'passport';
import authController from '../controller/auth.controller.js';
import { loginUserValidationRules, registerUserValidationRules } from '../middlewares/validation.middleware.js';
import authenticateToken from '../middlewares/auth.middleware.js';

const router = express.Router();

// Existing
router.post('/register', registerUserValidationRules, authController.register);
router.post('/login', loginUserValidationRules, authController.login);

// Step 1: Send user to Google
router.get(
	'/google',
	passport.authenticate('google', {
		scope: ['profile', 'email'],
		session: false,
	})
);

// Step 2: Google redirects back here
router.get(
	'/google/callback',
	passport.authenticate('google', {
		session: false,
		failureRedirect: '/api/auth/google/failure',
	}),
	authController.googleCallback
);

// If Google login fails
router.get('/google/failure', (req, res) => {
	return res.status(401).json({
		success: false,
		message: 'Google authentication failed. Try again.',
	});
});

router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);

export default router;