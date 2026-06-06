import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';

// ── Helper: validate MongoDB ObjectId early to avoid CastError ───────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Helper: add per-user state flags to posts ────────────────────────
const addStateFlags = (posts, userId) =>
	posts.map((post) => ({
		...post,
		likedByMe: post.likedBy?.some((id) => id.toString() === userId) || false,
		sharedByMe: post.sharedBy?.some((id) => id.toString() === userId) || false,
		isOwner: post.author?._id?.toString() === userId || post.author?.toString() === userId,
	}));

// ── POST /api/posts ──────────────────────────────────────────────────
export const createPost = async (req, res) => {
	try {
		const { content, image } = req.body;

		if (!content && !image) {
			return res.status(400).json({
				success: false,
				message: 'A post must have content or an image.',
			});
		}

		const newPost = await Post.create({
			author: req.user.id,
			content: content || '',
			image: image || '',
		});

		pulse.onPostCreated(newPost);
		publish('post.created', { post: newPost });

		const populatedPost = await Post.findById(newPost._id).populate('author', 'fullname').lean();

		return res.status(201).json({ success: true, post: populatedPost ?? newPost });
	} catch (err) {
		console.error('createPost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/feed ──────────────────────────────────────────────
// Paginated via ?page & ?limit. Populates author name for frontend rendering.
export const getFeed = async (req, res) => {
	try {
		const page  = Math.max(1, parseInt(req.query.page)  || 1);
		const limit = Math.min(50, parseInt(req.query.limit) || 10);
		const skip  = (page - 1) * limit;
		const userId = req.user.id;

		const posts = await Post.find()
			.sort({ createdAt: -1 })          // uses the index defined in post.model.js
			.skip(skip)
			.limit(limit)
			.populate('author', 'fullname')   // pulls firstName/lastName from auth-service users
			.lean();
		const postsWithState = addStateFlags(posts, userId);

		const total = await Post.countDocuments();

		return res.status(200).json({
			success: true,
			page,
			totalPages: Math.ceil(total / limit),
			total,
			posts: postsWithState,
		});
	} catch (err) {
		console.error('getFeed error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/:id ───────────────────────────────────────────────
export const getPost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const userId = req.user.id;

		const post = await Post.findById(req.params.id)
			.populate('author', 'fullname')
			.lean();

		if (!post) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		const [postWithState] = addStateFlags([post], userId);

		return res.status(200).json({ success: true, post: postWithState });
	} catch (err) {
		console.error('getPost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/user/:userId ──────────────────────────────────────
export const getPostsByUser = async (req, res) => {
	try {
		if (!isValidId(req.params.userId)) {
			return res.status(400).json({ success: false, message: 'Invalid user ID.' });
		}

		const posts = await Post.find({ author: req.params.userId })
			.sort({ createdAt: -1 })
			.populate('author', 'fullname')
			.lean();

		return res.status(200).json({ success: true, posts });
	} catch (err) {
		console.error('getPostsByUser error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── DELETE /api/posts/:id ────────────────────────────────────────────
export const deletePost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const post = await Post.findById(req.params.id);

		if (!post) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		if (post.author.toString() !== req.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized to delete this post.' });
		}

		await post.deleteOne();

		return res.status(200).json({ success: true, message: 'Post deleted.' });
	} catch (err) {
		console.error('deletePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};