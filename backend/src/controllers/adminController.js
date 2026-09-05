const { pool } = require('../config/db');
const ml = require('../services/mlClient');

/** GET /api/admin/feedback — everything users reported, newest first. */
exports.feedback = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, u.name, u.email, d.fruit, d.stage AS predicted_stage
       FROM feedback f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN detections d ON d.id = f.detection_id
       ORDER BY f.created_at DESC LIMIT 500`
    );
    return res.json({ feedback: rows });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/metrics — usage plus the model's field accuracy proxy. */
exports.metrics = async (_req, res, next) => {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS n FROM users');
    const [[scans]] = await pool.query('SELECT COUNT(*) AS n FROM scans');
    const [[dets]] = await pool.query('SELECT COUNT(*) AS n FROM detections');
    const [stages] = await pool.query('SELECT stage, COUNT(*) AS n FROM detections GROUP BY stage');
    const [[latency]] = await pool.query('SELECT AVG(inference_ms) AS avg_ms FROM scans');

    // Every correction is a detection the user disagreed with: a live,
    // if biased, estimate of stage accuracy in real conditions.
    const [[corrections]] = await pool.query(
      'SELECT COUNT(*) AS n FROM feedback WHERE corrected_stage IS NOT NULL'
    );
    const fieldAccuracy = dets.n ? 1 - corrections.n / dets.n : null;

    let mlHealth = null;
    try { mlHealth = await ml.health(); } catch { mlHealth = { status: 'unreachable' }; }

    return res.json({
      users: users.n,
      scans: scans.n,
      detections: dets.n,
      byStage: stages,
      avgInferenceMs: latency.avg_ms ? Number(latency.avg_ms).toFixed(1) : null,
      corrections: corrections.n,
      fieldStageAccuracy: fieldAccuracy,
      mlService: mlHealth,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/retraining-set
 * Exports the corrected detections as a JSON manifest to feed back into
 * scripts/prepare_dataset.py for the next training round.
 */
exports.retrainingSet = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.stored_filename, d.fruit, d.stage AS predicted, f.corrected_stage AS truth,
              d.box_x1, d.box_y1, d.box_x2, d.box_y2
       FROM feedback f
       JOIN detections d ON d.id = f.detection_id
       JOIN scans s ON s.id = d.scan_id
       WHERE f.corrected_stage IS NOT NULL`
    );
    return res.json({ count: rows.length, samples: rows });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/admin/users */
exports.users = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.language, u.created_at, u.last_login_at,
              COUNT(s.id) AS scans
       FROM users u LEFT JOIN scans s ON s.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    return res.json({ users: rows });
  } catch (err) {
    return next(err);
  }
};
