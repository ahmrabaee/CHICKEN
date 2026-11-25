// Shared helpers for T5 security tests.
import { request, connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
export const BASE = 'http://localhost:3109/v1';
export { request, connect };
export const log = (...a) => console.log(...a);
export async function login(u, p) {
  const r = await request(BASE, 'POST', '/auth/login', { body: { username: u, password: p } });
  return r;
}
