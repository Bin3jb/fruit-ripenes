/* Application shell: auth flow, scanning, grounded chat, history, admin. */

const el = (id) => document.getElementById(id);
const state = { file: null, scan: null, detections: [], labels: null };

/* Display labels come from the ML service via the API, so the taxonomy has one
   source of truth. Cached for the session; falls back to the raw keys. */
async function labels() {
  if (state.labels) return state.labels;
  try {
    const t = await API.taxonomy();
    state.labels = {
      fruits: Object.fromEntries(t.fruits.map((f) => [f.key, f])),
      stages: Object.fromEntries(t.stages.map((s) => [s.key, s])),
    };
  } catch {
    state.labels = { fruits: {}, stages: {} };
  }
  return state.labels;
}

function labelOf(group, key) {
  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return state.labels?.[group]?.[key]?.[lang] || String(key).replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ boot */
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(localStorage.getItem('lang') || 'en');
  wireAuth();
  wireNav();
  wireScan();
  wireChat();
  wireAccount();

  el('langToggle').addEventListener('click', async () => {
    const next = document.documentElement.lang === 'ar' ? 'en' : 'ar';
    applyLanguage(next);
    if (Auth.token) { try { await API.setLanguage(next); } catch { /* offline is fine */ } }
    if (state.detections.length) renderDetections(state.detections);
    renderSuggestions();
  });

  document.addEventListener('sessionexpired', showAuth);

  if (Auth.token) showApp(); else showAuth();
});

/* ------------------------------------------------------------------ auth */
function wireAuth() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t2) => t2.classList.remove('active'));
      tab.classList.add('active');
      el('loginForm').classList.toggle('hidden', tab.dataset.tab !== 'login');
      el('registerForm').classList.toggle('hidden', tab.dataset.tab !== 'register');
      el('authError').textContent = '';
    });
  });

  el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await API.login({ email: f.get('email'), password: f.get('password') });
      Auth.token = r.token; Auth.user = r.user;
      if (r.user.language) applyLanguage(r.user.language);
      showApp();
    } catch (err) { el('authError').textContent = err.message; }
  });

  el('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const r = await API.register({
        name: f.get('name'), email: f.get('email'),
        password: f.get('password'), language: document.documentElement.lang,
      });
      Auth.token = r.token; Auth.user = r.user;
      showApp();
    } catch (err) { el('authError').textContent = err.message; }
  });

  el('logoutBtn').addEventListener('click', async () => {
    try { await API.logout(); } catch { /* token may already be gone */ }
    Auth.clear();
    showAuth();
  });
}

function showAuth() {
  el('authView').classList.remove('hidden');
  el('appView').classList.add('hidden');
  el('logoutBtn').classList.add('hidden');
  el('userChip').classList.add('hidden');
}

function showApp() {
  el('authView').classList.add('hidden');
  el('appView').classList.remove('hidden');
  el('logoutBtn').classList.remove('hidden');
  const chip = el('userChip');
  chip.textContent = Auth.user?.name || '';
  chip.classList.remove('hidden');
  el('adminNav').classList.toggle('hidden', Auth.user?.role !== 'admin');
  renderSuggestions();
  labels();
}

/** Switch the main view without going through the nav button. */
function goTo(view) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  el(`view-${view}`).classList.remove('hidden');
}

/* ------------------------------------------------------------------- nav */
function wireNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
      el(`view-${btn.dataset.view}`).classList.remove('hidden');
      if (btn.dataset.view === 'history') loadHistory();
      if (btn.dataset.view === 'basket') loadBasket();
      if (btn.dataset.view === 'account') loadMyFeedback();
      if (btn.dataset.view === 'admin') loadAdmin();
    });
  });
}

/* ------------------------------------------------------------------ scan */
function wireScan() {
  const dz = el('dropzone');
  const input = el('fileInput');

  dz.addEventListener('click', () => input.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('drag');
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files[0]) pickFile(input.files[0]); });

  el('analyzeBtn').addEventListener('click', analyse);
}

function pickFile(file) {
  if (!file.type.startsWith('image/')) {
    el('scanError').textContent = 'Please choose an image file.';
    return;
  }
  state.file = file;
  el('scanError').textContent = '';
  const img = el('preview');
  img.src = URL.createObjectURL(file);
  img.classList.remove('hidden');
  el('analyzeBtn').classList.remove('hidden');
}

async function analyse() {
  if (!state.file) return;
  el('scanError').textContent = '';
  el('resultEmpty').classList.add('hidden');
  el('annotated').classList.add('hidden');
  el('detections').innerHTML = '';
  el('meta').textContent = '';
  el('spinner').classList.remove('hidden');
  el('analyzeBtn').disabled = true;

  try {
    const r = await API.detect(state.file, document.documentElement.lang);
    state.scan = r.scanId;
    state.detections = r.detections;

    if (r.annotated_url) {
      const img = el('annotated');
      img.src = r.annotated_url;
      img.classList.remove('hidden');
    }
    renderDetections(r.detections);
    el('meta').textContent = `${r.count} detection(s) · ${r.inference_ms} ms · ${r.model}`
      + (r.mode === 'coco' ? ` · ${t('label.fallbackMode')}` : '');
    el('chatLog').innerHTML = '';
    renderSuggestions();
  } catch (err) {
    el('scanError').textContent = err.message;
    el('resultEmpty').classList.remove('hidden');
  } finally {
    el('spinner').classList.add('hidden');
    el('analyzeBtn').disabled = false;
  }
}

function renderDetections(detections) {
  const box = el('detections');
  box.innerHTML = '';
  if (!detections.length) {
    box.innerHTML = `<div class="empty">${t('scan.none')}</div>`;
    return;
  }

  detections.forEach((d, i) => {
    const card = document.createElement('div');
    card.className = `det ${d.stage}`;
    card.innerHTML = `
      <div class="det-head">
        <span class="det-name">${d.fruit_label}</span>
        <span class="badge ${d.stage}">${d.stage_label}</span>
      </div>
      <div class="conf-bar"><i style="width:${(d.confidence * 100).toFixed(0)}%"></i></div>
      <p class="det-advice">${d.advice}</p>
      <div class="det-facts">
        <span>${t('label.action')}: <b>${d.action_label}</b></span>
        <span>${t('label.room')}: <b>${d.days_room_temperature} ${t('label.days')}</b></span>
        <span>${t('label.fridge')}: <b>${d.days_refrigerated} ${t('label.days')}</b></span>
        <span>${t('label.confidence')}: <b>${(d.confidence * 100).toFixed(0)}%</b></span>
      </div>
      ${d.stage_refined ? `<div class="refined">${d.reason}</div>` : ''}
      ${d.stage_source === 'colour-only' ? `<div class="refined">${t('label.colourOnly')}</div>` : ''}
      <div class="correct-row" data-index="${i}">
        <small>${t('label.wrong')}</small>
        <button data-stage="unripe">${t('stage.unripe')}</button>
        <button data-stage="ripe">${t('stage.ripe')}</button>
        <button data-stage="overripe">${t('stage.overripe')}</button>
      </div>`;
    box.appendChild(card);
  });

  box.querySelectorAll('.correct-row button').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.correct-row');
      const d = state.detections[Number(row.dataset.index)];
      try {
        await API.feedback({
          detectionId: d.id || null,
          correctedStage: btn.dataset.stage,
          message: `correction for ${d.fruit}: predicted ${d.stage}`,
        });
        row.innerHTML = `<small>${t('label.corrected')}</small>`;
      } catch (err) { row.insertAdjacentHTML('beforeend', `<small class="error">${err.message}</small>`); }
    });
  });
}

/* ------------------------------------------------------------------ chat */
function wireChat() {
  el('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el('chatInput');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    send(q);
  });
}

function renderSuggestions() {
  const box = el('suggestions');
  if (!box) return;
  box.innerHTML = '';
  ['q1', 'q2', 'q3', 'q4'].forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t(k);
    b.addEventListener('click', () => send(t(k)));
    box.appendChild(b);
  });
}

function bubble(role, text, source) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  if (source) {
    const s = document.createElement('span');
    s.className = 'src';
    s.textContent = source;
    div.appendChild(s);
  }
  el('chatLog').appendChild(div);
  el('chatLog').scrollTop = el('chatLog').scrollHeight;
  return div;
}

async function send(question) {
  bubble('user', question);
  const pending = bubble('assistant', '…');
  try {
    const r = await API.ask({
      question,
      scanId: state.scan,
      lang: document.documentElement.lang,
    });
    pending.textContent = r.answer;
    const s = document.createElement('span');
    s.className = 'src';
    s.textContent = r.grounded ? `${r.source} · grounded in your scan` : r.source;
    pending.appendChild(s);
  } catch (err) {
    pending.textContent = err.message;
  }
}

/* --------------------------------------------------------------- history */
async function loadHistory() {
  const list = el('historyList');
  list.innerHTML = '';
  try {
    const { scans } = await API.history();
    if (!scans.length) { list.innerHTML = `<p class="empty">${t('history.empty')}</p>`; return; }
    scans.forEach((s) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'history-card';
      card.innerHTML = `
        ${s.annotated_url ? `<img src="${s.annotated_url}" alt="">` : ''}
        <div class="body">
          <div><b>${s.summary || '—'}</b></div>
          <div class="when">${new Date(s.created_at).toLocaleString()} · ${s.detection_count} item(s)</div>
        </div>`;
      card.addEventListener('click', () => openScan(s.id));
      list.appendChild(card);
    });
  } catch (err) { list.innerHTML = `<p class="error">${err.message}</p>`; }
}

/**
 * Reopen a stored scan: its annotated image, its detections and the
 * conversation that belongs to it. Lets a user come back to yesterday's photo
 * and keep asking questions about it.
 */
async function openScan(id) {
  await labels();
  goTo('scan');
  el('resultEmpty').classList.add('hidden');
  el('detections').innerHTML = '';
  el('chatLog').innerHTML = '';
  el('scanError').textContent = '';
  el('preview').classList.add('hidden');
  el('analyzeBtn').classList.add('hidden');

  try {
    const { scan, detections } = await API.scan(id);
    state.scan = scan.id;
    state.detections = detections.map((d) => ({
      id: d.id,
      fruit: d.fruit,
      stage: d.stage,
      fruit_label: labelOf('fruits', d.fruit),
      stage_label: labelOf('stages', d.stage),
      confidence: Number(d.confidence),
      advice: d.advice || '',
      action: d.recommended_action,
      action_label: t(`action.${d.recommended_action}`),
      days_room_temperature: d.days_room,
      days_refrigerated: d.days_fridge,
      stage_refined: !!d.stage_refined,
      reason: '',
    }));

    if (scan.annotated_url) {
      const img = el('annotated');
      img.src = scan.annotated_url;
      img.classList.remove('hidden');
    } else {
      el('annotated').classList.add('hidden');
    }
    renderDetections(state.detections);
    el('meta').textContent = `${scan.detection_count} detection(s) · `
      + `${new Date(scan.created_at).toLocaleString()}`;

    const { messages } = await API.thread(scan.id);
    messages.forEach((m) => bubble(m.role, m.content, m.role === 'assistant' ? m.source : null));
  } catch (err) {
    el('scanError').textContent = err.message;
  }
}

/* ---------------------------------------------------------------- basket */
async function loadBasket() {
  const stats = el('basketStats');
  const table = el('basketTable');
  stats.innerHTML = ''; table.innerHTML = '';
  try {
    const { byStage, byFruit } = await API.stats();
    const total = byStage.reduce((a, r) => a + Number(r.n), 0);
    ['unripe', 'ripe', 'overripe'].forEach((stage) => {
      const n = Number(byStage.find((r) => r.stage === stage)?.n || 0);
      const div = document.createElement('div');
      div.className = `stat ${stage}`;
      div.innerHTML = `<div class="n">${n}</div><div class="k">${t(`stage.${stage}`)}</div>`;
      stats.appendChild(div);
    });
    const waste = total ? ((Number(byStage.find((r) => r.stage === 'overripe')?.n || 0) / total) * 100).toFixed(0) : 0;
    stats.insertAdjacentHTML('beforeend',
      `<div class="stat"><div class="n">${waste}%</div><div class="k">spoiled share</div></div>`);

    if (byFruit.length) {
      const rows = byFruit.map((r) =>
        `<tr><td>${r.fruit}</td><td>${t(`stage.${r.stage}`)}</td><td>${r.n}</td></tr>`).join('');
      table.innerHTML = `<table><thead><tr><th>Fruit</th><th>Stage</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  } catch (err) { stats.innerHTML = `<p class="error">${err.message}</p>`; }
}

/* ----------------------------------------------------------------- admin */
async function loadAdmin() {
  const m = el('adminMetrics');
  const f = el('adminFeedback');
  m.innerHTML = ''; f.innerHTML = '';
  try {
    const s = await API.adminMetrics();
    const tiles = [
      ['users', s.users], ['scans', s.scans], ['detections', s.detections],
      ['avg latency (ms)', s.avgInferenceMs ?? '—'],
      ['corrections', s.corrections],
      ['field stage accuracy', s.fieldStageAccuracy != null ? `${(s.fieldStageAccuracy * 100).toFixed(1)}%` : '—'],
    ];
    tiles.forEach(([k, v]) => {
      m.insertAdjacentHTML('beforeend', `<div class="stat"><div class="n">${v}</div><div class="k">${k}</div></div>`);
    });

    const { feedback } = await API.adminFeedback();
    if (!feedback.length) { f.innerHTML = '<p class="empty">No feedback yet.</p>'; return; }
    const rows = feedback.map((r) => `<tr>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td>${r.name}</td>
      <td>${r.fruit || '—'}</td>
      <td>${r.predicted_stage || '—'}</td>
      <td>${r.corrected_stage || '—'}</td>
      <td>${r.message || ''}</td></tr>`).join('');
    f.innerHTML = `<table><thead><tr><th>Date</th><th>User</th><th>Fruit</th>
      <th>Predicted</th><th>Corrected</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) { m.innerHTML = `<p class="error">${err.message}</p>`; }
}

/* --------------------------------------------------------------- account */
function wireAccount() {
  el('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = el('accountMsg');
    try {
      await API.changePassword({
        currentPassword: f.get('currentPassword'),
        newPassword: f.get('newPassword'),
      });
      msg.textContent = 'Password updated.';
      msg.className = 'notice';
      e.target.reset();
    } catch (err) { msg.textContent = err.message; msg.className = 'error'; }
  });

  el('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = el('feedbackMsg');
    try {
      await API.feedback({ message: f.get('message') });
      msg.textContent = t('feedback.thanks');
      msg.className = 'notice';
      e.target.reset();
      loadMyFeedback();
    } catch (err) { msg.textContent = err.message; msg.className = 'error'; }
  });
}

/** Everything this user has reported, including stage corrections. */
async function loadMyFeedback() {
  const box = el('myFeedback');
  if (!box) return;
  box.innerHTML = '';
  try {
    const { feedback } = await API.myFeedback();
    if (!feedback.length) { box.innerHTML = `<p class="empty">${t('feedback.none')}</p>`; return; }
    const rows = feedback.map((r) => `<tr>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td>${r.corrected_stage ? t(`stage.${r.corrected_stage}`) : '—'}</td>
      <td>${r.message || ''}</td></tr>`).join('');
    box.innerHTML = `<table><thead><tr>
      <th>${t('feedback.date')}</th><th>${t('feedback.correction')}</th><th>${t('feedback.message')}</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) { box.innerHTML = `<p class="error">${err.message}</p>`; }
}
