const { pool } = require('../config/db');
const llm = require('../services/llm');
const ml = require('../services/mlClient');

/**
 * POST /api/chat
 * body: { question, scanId?, lang? }
 * The scan (if given) grounds the answer in real detections.
 */
exports.ask = async (req, res, next) => {
  const { question, scanId } = req.body;
  const lang = req.body.lang === 'ar' ? 'ar' : 'en';
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'please type a question' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ error: 'question is too long (1000 characters max)' });
  }

  try {
    let detections = [];
    let grounding = '';

    if (scanId) {
      const [scans] = await pool.query(
        'SELECT id FROM scans WHERE id = ? AND user_id = ?', [scanId, req.user.id]
      );
      if (!scans.length) return res.status(404).json({ error: 'scan not found' });

      const [rows] = await pool.query(
        `SELECT fruit, stage, confidence, recommended_action AS action, advice,
                days_room AS days_room_temperature, days_fridge AS days_refrigerated
         FROM detections WHERE scan_id = ?`, [scanId]
      );
      const maps = await ml.labels();
      detections = await Promise.all(rows.map(async (r) => {
        // The scan stored its advice in the language it was made in; ask the
        // knowledge base again so this conversation gets its own language.
        const localised = await ml.advice(r.fruit, r.stage, lang);
        return {
          ...r,
          confidence: Number(r.confidence),
          advice: localised?.advice || r.advice,
          action_label: localised?.action_label,
          fruit_label: ml.label(maps.fruits, r.fruit, lang),
          stage_label: ml.label(maps.stages, r.stage, lang),
        };
      }));
      grounding = detections
        .map((d) => `- ${d.fruit} / ${d.stage} (confidence ${d.confidence.toFixed(2)}): `
          + `${d.advice || ''} Recommended action: ${d.action}. `
          + `Approx. ${d.days_room_temperature} day(s) at room temperature, `
          + `${d.days_refrigerated} day(s) refrigerated.`)
        .join('\n');
    }

    const [history] = scanId
      ? await pool.query(
        `SELECT role, content FROM messages
         WHERE user_id = ? AND scan_id = ? ORDER BY id DESC LIMIT 8`,
        [req.user.id, scanId]
      )
      : [[]];

    const { answer, source } = await llm.ask({
      question,
      detections,
      grounding,
      history: history.reverse(),
      lang,
    });

    await pool.query(
      'INSERT INTO messages (user_id, scan_id, role, content) VALUES (?, ?, ?, ?)',
      [req.user.id, scanId || null, 'user', question]
    );
    await pool.query(
      'INSERT INTO messages (user_id, scan_id, role, content, source) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, scanId || null, 'assistant', answer, source]
    );

    return res.json({ answer, source, grounded: detections.length > 0 });
  } catch (err) {
    return next(err);
  }
};

/** GET /api/chat/:scanId — conversation attached to one scan. */
exports.thread = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT role, content, source, created_at FROM messages
       WHERE user_id = ? AND scan_id = ? ORDER BY id ASC`,
      [req.user.id, req.params.scanId]
    );
    return res.json({ messages: rows });
  } catch (err) {
    return next(err);
  }
};
