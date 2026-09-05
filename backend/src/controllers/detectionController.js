const path = require('path');
const { pool } = require('../config/db');
const ml = require('../services/mlClient');

/**
 * POST /api/detect
 * Runs the detector, stores the scan and every detected fruit, and returns
 * the enriched payload the UI renders.
 */
exports.detect = async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'please attach an image' });

  const lang = req.body.lang === 'ar' ? 'ar' : 'en';
  const conn = await pool.getConnection();
  try {
    const result = await ml.detect(req.file.path, lang);

    await conn.beginTransaction();
    const [scan] = await conn.query(
      `INSERT INTO scans (user_id, original_filename, stored_filename, annotated_url,
                          detection_count, inference_ms, model_name, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        req.file.originalname,
        path.basename(req.file.path),
        result.annotated_url || null,
        result.count,
        result.inference_ms,
        result.model,
        lang,
      ]
    );

    for (const d of result.detections) {
      const [row] = await conn.query(
        `INSERT INTO detections (scan_id, fruit, stage, stage_from_detector, stage_refined,
                                 confidence, recommended_action, days_room, days_fridge,
                                 advice, box_x1, box_y1, box_x2, box_y2, color_cues)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scan.insertId, d.fruit, d.stage, d.stage_from_detector, d.stage_refined ? 1 : 0,
          d.confidence, d.action, d.days_room_temperature, d.days_refrigerated, d.advice,
          d.box.x1, d.box.y1, d.box.x2, d.box.y2, JSON.stringify(d.color_cues),
        ]
      );
      // The UI needs the row id so a user can correct a specific detection.
      d.id = row.insertId;
    }
    await conn.commit();

    return res.status(201).json({ scanId: scan.insertId, ...result });
  } catch (err) {
    await conn.rollback().catch(() => {});
    return next(err);
  } finally {
    conn.release();
  }
};

/** GET /api/detect/history — the signed-in user's previous scans. */
exports.history = async (req, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  try {
    const [scans] = await pool.query(
      `SELECT s.id, s.original_filename, s.annotated_url, s.detection_count,
              s.inference_ms, s.created_at,
              GROUP_CONCAT(CONCAT(d.fruit, ':', d.stage) SEPARATOR ', ') AS summary
       FROM scans s
       LEFT JOIN detections d ON d.scan_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    return res.json({ scans });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/detect/:id — one scan with its detections. */
exports.getScan = async (req, res, next) => {
  try {
    const [scans] = await pool.query(
      'SELECT * FROM scans WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!scans.length) return res.status(404).json({ error: 'scan not found' });

    const [detections] = await pool.query(
      'SELECT * FROM detections WHERE scan_id = ?', [req.params.id]
    );
    return res.json({ scan: scans[0], detections });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/detect/classes — taxonomy for the UI legend. */
exports.classes = async (_req, res, next) => {
  try {
    return res.json(await ml.classes());
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/detect/stats — aggregate ripeness picture for the signed-in user.
 * Feeds the "your fruit basket" panel: how much of what they scan is going to
 * waste, which is the outcome the project is really about.
 */
exports.stats = async (req, res, next) => {
  try {
    const [byStage] = await pool.query(
      `SELECT d.stage, COUNT(*) AS n
       FROM detections d JOIN scans s ON s.id = d.scan_id
       WHERE s.user_id = ? GROUP BY d.stage`,
      [req.user.id]
    );
    const [byFruit] = await pool.query(
      `SELECT d.fruit, d.stage, COUNT(*) AS n
       FROM detections d JOIN scans s ON s.id = d.scan_id
       WHERE s.user_id = ? GROUP BY d.fruit, d.stage`,
      [req.user.id]
    );
    return res.json({ byStage, byFruit });
  } catch (err) {
    return next(err);
  }
};
