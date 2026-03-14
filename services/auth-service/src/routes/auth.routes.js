import express from 'express';
import authController from '../controller/auth.controller.js';
import { registerUserValidationRules } from '../middlewares/validation.middleware.js';

const router = express.Router();

router.post('/register', registerUserValidationRules, authController.register);

export default router;
