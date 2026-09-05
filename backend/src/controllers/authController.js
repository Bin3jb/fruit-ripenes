const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { sign } = require('../middleware/auth');

function bad(res, errors) {
  return res.status(400).json({ error: 'validation failed', details: errors.array() });
}

exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return bad(res, errors);

  const { name, email, password, language = 'en' } = req.body;
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'that email is already registered' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, language) VALUES (?, ?, ?, ?)',
      [name, email, hash, language]
    );
    const user = { id: result.insertId, name, email, role: 'user', language };
    return res.status(201).json({ user, token: sign(user) });
  } catch (err) {
    return next(err);
  }
};

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return bad(res, errors);

  const { email, password } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role, language FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) return res.status(401).json({ error: 'incorrect email or password' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'incorrect email or password' });

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    delete user.password_hash;
    return res.json({ user, token: sign(user) });
  } catch (err) {
    return next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, language, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: rows[0] });
  } catch (err) {
    return next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return bad(res, errors);

  const { currentPassword, newPassword } = req.body;
  try {
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'user not found' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    return res.json({ message: 'password updated' });
  } catch (err) {
    return next(err);
  }
};

exports.setLanguage = async (req, res, next) => {
  const lang = req.body.language === 'ar' ? 'ar' : 'en';
  try {
    await pool.query('UPDATE users SET language = ? WHERE id = ?', [lang, req.user.id]);
    return res.json({ language: lang });
  } catch (err) {
    return next(err);
  }
};

/** Stateless JWT: logout is recorded for the audit trail, the client drops the token. */
exports.logout = async (req, res, next) => {
  try {
    await pool.query('INSERT INTO audit_log (user_id, action) VALUES (?, ?)', [req.user.id, 'logout']);
    return res.json({ message: 'signed out' });
  } catch (err) {
    return next(err);
  }
};
