// Minimal shared API client for QA scripts.
// import { connect } from '<qa>/harness/client.mjs';
// const c = await connect('http://localhost:3101/v1', 'admin', 'admin123');
// const r = await c.get('/items');  -> { status, ok, body, data }
// Never throws on HTTP errors: inspect r.status / r.body. Throws only on network failure.
export async function request(baseUrl, method, path, { body, token, headers = {}, raw = false } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, ok: res.ok, body: parsed, data: parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed };
}

export async function connect(baseUrl, username, password) {
  const r = await request(baseUrl, 'POST', '/auth/login', { body: { username, password } });
  if (!r.ok) throw new Error(`login failed for ${username}: ${r.status} ${JSON.stringify(r.body)}`);
  const token = r.data.accessToken;
  const call = (method) => (path, body, opts = {}) => request(baseUrl, method, path, { body, token, ...opts });
  return {
    token,
    user: r.data.user,
    get: call('GET'),
    post: call('POST'),
    put: call('PUT'),
    patch: call('PATCH'),
    del: call('DELETE'),
    raw: (method, path, opts = {}) => request(baseUrl, method, path, { token, ...opts }),
  };
}
