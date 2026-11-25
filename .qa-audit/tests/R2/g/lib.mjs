import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
export const BASE = process.env.BASE || 'http://localhost:3125/v1';
export { connect, request };
export const show = (label, r) => console.log(label.padEnd(58), r.status, JSON.stringify(r.body).slice(0, 260));
