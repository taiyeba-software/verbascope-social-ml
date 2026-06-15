import { body, validationResult } from 'express-validator';

// ── Reusable handler that sends back validation errors ───────────────
export const handleValidationErrors = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(422).json({ success: false, errors: errors.array() });
	}
	next();
};

// ── Post validation rules ────────────────────────────────────────────
export const validatePost = [
	body('content')
		.optional()
		.isString()
		.withMessage('Content must be a string.')
		.isLength({ max: 3000 })
		.withMessage('Content cannot exceed 3000 characters.'),
	// At least one of content or image must be present — checked in controller
	handleValidationErrors,
];

// ── Comment validation rules ─────────────────────────────────────────
export const validateComment = [
	body('content')
		.notEmpty()
		.withMessage('Comment content is required.')
		.isString()
		.withMessage('Content must be a string.')
		.isLength({ max: 500 })
		.withMessage('Comment cannot exceed 500 characters.'),
	handleValidationErrors,
];