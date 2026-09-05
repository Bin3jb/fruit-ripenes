/* Thin fetch wrapper: attaches the JWT, unwraps errors into thrown Errors. */
const API_BASE = window.API_BASE || '/api';

const Auth = {
  get token() { return localStorage.getItem('token'); },
  set token(v) { v ? localStorage.setItem('token', v) : localStorage.removeItem('token'); },
  get user() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
  set user(u) { u ? localStorage.setItem('user', JSON.stringify(u)) : localStorage.removeItem('user'); },
  clear() { this.token = null; this.user = null; },
};

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (Auth.token) headers.Authorization = `Bearer ${Auth.token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (res.status === 401 && Auth.token) {
    Auth.clear();
    document.dispatchEvent(new Event('sessionexpired'));
  }
  if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
  return data;
}

const API = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  setLanguage: (language) => request('/auth/language', { method: 'PATCH', body: { language } }),
  changePassword: (b) => request('/auth/change-password', { method: 'POST', body: b }),

  detect: (file, lang) => {
    const form = new FormData();
    form.append('image', file);
    form.append('lang', lang);
    return request('/detect', { method: 'POST', form });
  },
  history: () => request('/detect/history'),
  stats: () => request('/detect/stats'),
  scan: (id) => request(`/detect/${id}`),
  taxonomy: () => request('/detect/classes'),

  ask: (b) => request('/chat', { method: 'POST', body: b }),
  thread: (scanId) => request(`/chat/${scanId}`),
  feedback: (b) => request('/feedback', { method: 'POST', body: b }),
  myFeedback: () => request('/feedback/mine'),

  adminMetrics: () => request('/admin/metrics'),
  adminFeedback: () => request('/admin/feedback'),
};
