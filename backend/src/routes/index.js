const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const auth = require('../controllers/authController');
const detection = require('../controllers/detectionController');
const chat = require('../controllers/chatController');
const feedback = require('../controllers/feedbackController');
const admin = require('../controllers/adminController');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const detectLimiter = rateLimit({ windowMs: 60 * 1000, max: 15 });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

// --- authentication -------------------------------------------------------
router.post('/auth/register', authLimiter, [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('name must be 2-80 characters'),
  body('email').isEmail().normalizeEmail().withMessage('a valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
], auth.register);

router.post('/auth/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], auth.login);

router.get('/auth/me', requireAuth, auth.me);
router.post('/auth/logout', requireAuth, auth.logout);
router.patch('/auth/language', requireAuth, auth.setLanguage);
router.post('/auth/change-password', requireAuth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('new password must be at least 8 characters'),
], auth.changePassword);

// --- detection ------------------------------------------------------------
router.get('/detect/classes', detection.classes);
router.post('/detect', requireAuth, detectLimiter, upload.single('image'), detection.detect);
router.get('/detect/history', requireAuth, detection.history);
router.get('/detect/stats', requireAuth, detection.stats);
router.get('/detect/:id', requireAuth, detection.getScan);

// --- assistant ------------------------------------------------------------
router.post('/chat', requireAuth, chatLimiter, chat.ask);
router.get('/chat/:scanId', requireAuth, chat.thread);

// --- feedback -------------------------------------------------------------
router.post('/feedback', requireAuth, feedback.create);
router.get('/feedback/mine', requireAuth, feedback.mine);

// --- administration -------------------------------------------------------
router.get('/admin/feedback', requireAuth, requireAdmin, admin.feedback);
router.get('/admin/metrics', requireAuth, requireAdmin, admin.metrics);
router.get('/admin/users', requireAuth, requireAdmin, admin.users);
router.get('/admin/retraining-set', requireAuth, requireAdmin, admin.retrainingSet);

module.exports = router;
