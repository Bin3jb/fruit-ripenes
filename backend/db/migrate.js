/**
 * Applies db/schema.sql and seeds an administrator account.
 *   node db/migrate.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('schema applied');

  await conn.changeUser({ database: process.env.DB_NAME || 'fruit_ripeness' });
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 12);
    await conn.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      ['System Admin', email, hash]
    );
    console.log(`seeded admin: ${email}`);
  }

  await conn.end();
})().catch((e) => { console.error(e); process.exit(1); });
