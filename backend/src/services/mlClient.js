const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const BASE = process.env.ML_SERVICE_URL || 'http://localhost:5001';

async function health() {
  const { data } = await axios.get(`${BASE}/health`, { timeout: 5000 });
  return data;
}

async function classes() {
  const { data } = await axios.get(`${BASE}/classes`, { timeout: 5000 });
  return data;
}

/**
 * Display labels ({ fruits: {key: {en, ar}}, stages: {...} }), cached in memory.
 * The taxonomy is owned by the Python service; the backend asks rather than
 * keeping a second copy that can drift. Falls back to the raw keys if the ML
 * service is down, so a chat answer degrades instead of failing.
 */
let labelCache = null;
async function labels() {
  if (labelCache) return labelCache;
  try {
    const data = await classes();
    labelCache = {
      fruits: Object.fromEntries(data.fruits.map((f) => [f.key, { en: f.en, ar: f.ar }])),
      stages: Object.fromEntries(data.stages.map((s) => [s.key, { en: s.en, ar: s.ar }])),
    };
  } catch {
    labelCache = null;
    return { fruits: {}, stages: {} };
  }
  return labelCache;
}

/** Language-aware advice for one fruit/stage pair, cached in memory. */
const adviceCache = new Map();
async function advice(fruit, stage, lang = 'en') {
  const key = `${fruit}|${stage}|${lang}`;
  if (adviceCache.has(key)) return adviceCache.get(key);
  try {
    const { data } = await axios.get(`${BASE}/advice`, {
      params: { fruit, stage, lang }, timeout: 5000,
    });
    adviceCache.set(key, data);
    return data;
  } catch {
    return null;                       // caller falls back to the stored text
  }
}

function label(map, key, lang) {
  return map?.[key]?.[lang] || key.replace(/_/g, ' ');
}

/**
 * Send an uploaded image to the Flask detector.
 * Returns the raw prediction payload (detections + annotated image URL).
 */
async function detect(filePath, lang = 'en') {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  form.append('lang', lang);

  try {
    const { data } = await axios.post(`${BASE}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 60000,
      maxBodyLength: Infinity,
    });
    if (data.annotated_url) data.annotated_url = `${BASE}${data.annotated_url}`;
    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      const e = new Error('the detection service is not running');
      e.status = 503;
      throw e;
    }
    const e = new Error(err.response?.data?.error || 'detection failed');
    e.status = err.response?.status || 502;
    throw e;
  }
}

module.exports = { health, classes, labels, label, advice, detect, BASE };
