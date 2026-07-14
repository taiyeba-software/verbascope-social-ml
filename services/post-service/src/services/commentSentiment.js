/**
 * commentSentiment.js
 * ---------------------------------------------------------------------------
 * Milestone 3 — Comment Sentiment
 *
 * Path: services/post-service/src/services/commentSentiment.js
 *
 * Design note: classifyComment() is async and returns a stable
 * { label, score } shape on purpose. Today it's a keyword lookup. Later,
 * it can call out to your FastAPI + BanglaBERT service instead — the
 * caller (comment.controller.js) never needs to change either way.
 *
 * v2: the original word lists were too "formal" — real comments lean on
 * slang, insults, profanity, and emoji far more than words like "excellent"
 * or "disappointing". This version widens the vocabulary and adds emoji
 * scoring, since the tokenizer previously stripped emoji out entirely
 * before matching (they aren't \w characters).
 *
 * v3: catches self-censored profanity like "mother*%$c$er" or "sh*t".
 * A plain word-list lookup can't see these because the letters underneath
 * the mask are gone. Instead: strip the censor characters out of the token
 * to get a "skeleton" of whatever letters survived, in order (e.g.
 * "mother*%$c$er" -> "mothercer"), then check whether that skeleton is a
 * *subsequence* of a known root word — i.e. its letters appear in the same
 * order inside the real word, just with gaps where letters were masked out.
 * Two guards keep this from over-firing on ordinary punctuation: the
 * skeleton must share the root's first letter, and must retain at least
 * ~40% of the root's length.
 * ---------------------------------------------------------------------------
 */

const POSITIVE_WORDS = [
	'love', 'loved', 'loving', 'great', 'awesome', 'amazing', 'good', 'nice',
	'excellent', 'fantastic', 'wonderful', 'perfect', 'best', 'happy',
	'beautiful', 'brilliant', 'impressive', 'thanks', 'thank', 'appreciate',
	'cool', 'congrats', 'congratulations', 'helpful', 'like', 'enjoy',
	'enjoyed', 'fun', 'glad', 'super', 'incredible', 'outstanding',
	// casual / slang positive
	'lol', 'lmao', 'haha', 'lit', 'fire', 'dope', 'goated', 'based', 'vibe',
	'vibes', 'legend', 'king', 'queen', 'w', 'slay', 'proud', 'blessed',
	'yay', 'yes', 'true', 'facts', 'real', 'relatable', 'same', 'mood',
	'adorable', 'cute', 'sweet', 'wholesome', 'genius', 'smart', 'talented',
];

const NEGATIVE_WORDS = [
	'hate', 'hated', 'garbage', 'terrible', 'awful', 'bad', 'worst',
	'horrible', 'disgusting', 'trash', 'useless', 'broken', 'annoying',
	'stupid', 'disappointing', 'disappointed', 'sucks', 'poor', 'waste',
	'boring', 'ugly', 'wrong', 'fail', 'failed', 'failure', 'angry', 'mad',
	'sad', 'upset', 'ridiculous', 'pathetic', 'lame', 'cringe', 'cringy',
	'weird', 'creepy', 'gross', 'toxic', 'fake', 'liar', 'lying', 'scam',
	// insults / slang negative
	'idiot', 'idiotic', 'moron', 'dumb', 'clown', 'loser', 'jealous',
	'petty', 'delusional', 'unhinged', 'jobless', 'broke', 'shame',
	'shameful', 'embarrassing', 'embarrassed', 'disrespectful', 'rude',
	'nasty', 'furious', 'pissed', 'irritated', 'l', // "L" as in "take an L"
	// mild profanity — comments will contain this, classifier should catch it
	'damn', 'hell', 'crap', 'shit', 'shitty', 'ass', 'asshole', 'bitch',
	'bastard', 'dick', 'piss', 'screwed', 'fuck', 'fucking', 'fucked',
];

// Small negation list so "not good" doesn't score as positive.
const NEGATIONS = ['not', "n't", 'no', 'never', 'without', "isn't", "wasn't"];

// Emoji are stripped by the word tokenizer (they aren't \w characters), so
// they're matched separately, directly against the raw text, before any
// cleanup happens.
const POSITIVE_EMOJI = ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '🎉', '🥳', '👍', '❤️', '💕', '🔥', '✨', '💯', '😎', '🙌', '👏'];
const NEGATIVE_EMOJI = ['😡', '🤬', '😠', '👎', '😢', '😭', '💩', '🤮', '😤', '🙄', '😒', '😞', '😔', '💔'];

function countEmojiHits(text, emojiList) {
	let count = 0;
	for (const emoji of emojiList) {
		count += text.split(emoji).length - 1;
	}
	return count;
}

function tokenize(text) {
	return text
		.toLowerCase()
		.replace(/[^\w\s']/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
}

// --- Masked / self-censored profanity detection -----------------------
// Only a small, curated set of roots — this is a targeted check for
// deliberate censorship, not a general profanity dictionary (that's what
// NEGATIVE_WORDS already covers for plain, unmasked spelling).
const MASKED_PROFANITY_ROOTS = [
	'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit',
	'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'whore', 'slut',
];

// Characters people commonly substitute for letters when self-censoring.
const CENSOR_CHAR_PATTERN = /[*$#%@^]/;

// Strips everything except letters, so "mother*%$c$er" -> "mothercer".
function letterSkeleton(token) {
	return token.toLowerCase().replace(/[^a-z]/g, '');
}

// Is `sub` a subsequence of `full`? i.e. do sub's letters appear in full,
// in the same order, possibly with gaps (gaps = the masked-out letters).
function isSubsequence(sub, full) {
	let i = 0;
	for (let j = 0; j < full.length && i < sub.length; j++) {
		if (full[j] === sub[i]) i++;
	}
	return i === sub.length;
}

function isMaskedProfanity(rawToken) {
	if (!CENSOR_CHAR_PATTERN.test(rawToken)) return false;

	const skeleton = letterSkeleton(rawToken);
	if (skeleton.length < 3) return false;

	return MASKED_PROFANITY_ROOTS.some((root) => {
		if (skeleton[0] !== root[0]) return false;
		if (skeleton.length / root.length < 0.4) return false;
		return isSubsequence(skeleton, root);
	});
}

/**
 * @param {string} text - raw comment content
 * @returns {Promise<{ label: 'positive' | 'negative' | 'neutral', score: number }>}
 */
export async function classifyComment(text) {
	if (!text || typeof text !== 'string') {
		return { label: 'neutral', score: 0 };
	}

	// Emoji first, against the raw (non-lowercased, non-stripped) text.
	let positiveHits = countEmojiHits(text, POSITIVE_EMOJI);
	let negativeHits = countEmojiHits(text, NEGATIVE_EMOJI);

	// Masked/censored profanity — needs the RAW tokens (censor characters
	// still intact), so this runs before the clean tokenize() below, which
	// would strip those characters out.
	const rawTokens = text.split(/\s+/).filter(Boolean);
	rawTokens.forEach((rawToken) => {
		if (isMaskedProfanity(rawToken)) negativeHits++;
	});

	const words = tokenize(text);

	words.forEach((word, i) => {
		const precededByNegation = i > 0 && NEGATIONS.includes(words[i - 1]);

		if (POSITIVE_WORDS.includes(word)) {
			precededByNegation ? negativeHits++ : positiveHits++;
		} else if (NEGATIVE_WORDS.includes(word)) {
			precededByNegation ? positiveHits++ : negativeHits++;
		}
	});

	const totalHits = positiveHits + negativeHits;
	if (totalHits === 0) {
		return { label: 'neutral', score: 0 };
	}

	const rawScore = (positiveHits - negativeHits) / totalHits;

	let label = 'neutral';
	if (rawScore > 0.2) label = 'positive';
	else if (rawScore < -0.2) label = 'negative';

	return { label, score: Number(rawScore.toFixed(2)) };
}