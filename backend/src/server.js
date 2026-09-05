require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const routes = require('./routes');
const { ping } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const ml = require('./services/mlClient');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// The interface is plain static files. FRONTEND_DIR lets a container mount it
// somewhere other than the sibling directory this repo uses.
const FRONTEND_DIR = process.env.FRONTEND_DIR
  || path.join(__dirname, '..', '..', 'frontend');

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(FRONTEND_DIR));

app.get('/api/health', async (_req, res) => {
  const out = { api: 'ok', database: 'unknown', mlService: 'unknown' };
  try { await ping(); out.database = 'ok'; } catch { out.database = 'unreachable'; }
  try { const h = await ml.health(); out.mlService = h.status; out.model = h.model; }
  catch { out.mlService = 'unreachable'; }
  const healthy = out.database === 'ok';
  res.status(healthy ? 200 : 503).json(out);
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await ping();
    console.log('[db] connected');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    console.error('     the API will start anyway; fix .env and restart');
  }
  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
    console.log(`[api] ML service expected at ${ml.BASE}`);
    console.log(`[api] serving the interface from ${FRONTEND_DIR}`);
  });
}

if (require.main === module) start();

module.exports = app;
