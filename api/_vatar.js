// Server-side helpers for Lagos Life (Vatar Games API). Runs only on Vercel, never in the browser.
// Secrets come from the Vercel project's environment variables:
//   VATAR_SECRET          vtr_test_… or vtr_live_… (API calls)
//   VATAR_WEBHOOK_SECRET  vtr_whsec_… (checks the webhook signature)
import crypto from 'node:crypto';

const BASE = 'https://lagoslife.app/api/games/v1';

// what the game sells; ids must match the products made in the Lagos Life dashboard
export const PRODUCTS = new Set(['naija-gloves']);

export async function vatar(path, { method = 'GET', body } = {}) {
  const secret = process.env.VATAR_SECRET;
  if (!secret) throw Object.assign(new Error('VATAR_SECRET is not set'), { status: 500, code: 'no_secret' });
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${secret}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || `Vatar ${r.status}`), { status: r.status, code: data.error || 'error' });
  return data;
}

export async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

export function signatureOk(raw, header, secret) {
  if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const want = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const got = header.slice(7);
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(want, 'hex'));
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
