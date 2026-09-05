const { pool } = require('../config/db');

/**
 * POST /api/feedback
 * Two kinds: free-text app feedback, and per-detection corrections
 * ("this was actually overripe"). The corrections are the valuable ones —
 * they become the next round of training data.
 */
exports.create = async (req, res, next) => {
  const { message, rating, detectionId, correctedStage } = req.body;
  if (!message && !correctedStage) {
    return res.status(400).json({ error: 'nothing to submit' });
  }
  const valid = ['unripe', 'ripe', 'overripe'];
  if (correctedStage && !valid.includes(correctedStage)) {
    return res.status(400).json({ error: 'corrected stage must be unripe, ripe or overripe' });
  }

  try {
    if (detectionId) {
      const [own] = await pool.query(
        `SELECT d.id FROM detections d JOIN scans s ON s.id = d.scan_id
         WHERE d.id = ? AND s.user_id = ?`, [detectionId, req.user.id]
      );
      if (!own.length) return res.status(404).json({ error: 'detection not found' });
    }

    const [result] = await pool.query(
      `INSERT INTO feedback (user_id, detection_id, message, rating, corrected_stage)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, detectionId || null, message || null, rating || null, correctedStage || null]
    );
    return res.status(201).json({ id: result.insertId, message: 'thank you for the feedback' });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/feedback/mine */
exports.mine = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]
    );
    return res.json({ feedback: rows });
  } catch (err) {
    return next(err);
  }
};
