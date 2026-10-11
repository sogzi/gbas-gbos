// POST /api/vatar-webhook  (Lagos Life → us). Enter https://gbas-gbos.applixr.com/api/vatar-webhook in the
// dashboard. We check the X-Vatar-Signature and answer 2xx quickly. A webhook is only a notification: the
// unlock itself happens when the game claims the purchase (/api/vatar-claim), which re-checks it with the
// API. A purchase the game never claimed (tab closed mid-payment) comes back through Vatar.purchases()
// the next time the player opens the game.
import { readRaw, send, signatureOk } from './_vatar.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const raw = await readRaw(req);
  if (!signatureOk(raw, req.headers['x-vatar-signature'], process.env.VATAR_WEBHOOK_SECRET)) {
    return send(res, 401, { error: 'bad_signature' });
  }
  let ev = {};
  try {
    ev = JSON.parse(raw.toString('utf8'));
  } catch {
    return send(res, 400, { error: 'bad_request' });
  }
  console.log('vatar-webhook', ev.type, ev.mode, ev.data?.purchaseId, ev.data?.productId);
  return send(res, 200, { ok: true });
}
