// POST /api/vatar-claim  { session, purchaseId }
// The game calls this after Lagos Life says a purchase went through. We never trust that claim: we check
// the session with Lagos Life to learn who is asking, fetch the purchase, make sure it's theirs, paid and
// something we sell, mark it delivered, and only then tell the game to unlock it.
import { vatar, readRaw, send, PRODUCTS } from './_vatar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  let input;
  try {
    input = JSON.parse((await readRaw(req)).toString('utf8') || '{}');
  } catch {
    return send(res, 400, { error: 'bad_request' });
  }
  const { session, purchaseId } = input;
  if (typeof session !== 'string' || typeof purchaseId !== 'string' || !/^[\w-]{1,128}$/.test(purchaseId)) {
    return send(res, 400, { error: 'bad_request' });
  }
  try {
    const who = await vatar('/session/verify', { method: 'POST', body: { session } });
    const p = await vatar(`/purchases/${encodeURIComponent(purchaseId)}`);
    if (p.playerId !== who.playerId) return send(res, 403, { error: 'not_yours' });
    if (p.mode !== who.mode) return send(res, 403, { error: 'wrong_mode' });
    if (!PRODUCTS.has(p.productId)) return send(res, 409, { error: 'unknown_product' });
    if (p.status === 'refunded') return send(res, 409, { error: 'refunded' });
    if (p.status !== 'paid' && p.status !== 'delivered') return send(res, 409, { error: 'not_paid' });
    if (p.status === 'paid') await vatar(`/purchases/${encodeURIComponent(purchaseId)}/deliver`, { method: 'POST' });
    return send(res, 200, { productId: p.productId, playerId: p.playerId });
  } catch (e) {
    const status = [400, 401, 403, 404, 409, 429].includes(e.status) ? e.status : 502;
    console.error('vatar-claim', e.status, e.code, e.message);
    return send(res, status, { error: e.code || 'error' });
  }
}
