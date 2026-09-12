// Serverless function — called by a small Google Apps Script that runs on a
// timer and reports which filenames currently sit in the client's Drive
// folder. Any Reel whose number prefix matches an uploaded file, and whose
// status is still "pendente", gets flipped to "gravado". Never downgrades or
// overwrites a Reel that's already Gravado/Editado/Publicado.
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SECRET = process.env.DRIVE_SYNC_SECRET;
const STATE_KEY = 'reels40mais:state:v1';

function idFromFilename(name) {
  const trimmed = String(name || '').trim();
  const m = trimmed.match(/^0?(\d{1,2})\s*[-–—._]/) || trimmed.match(/^0?(\d{1,2})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!(n >= 1 && n <= 20)) return null;
  return String(n).padStart(2, '0');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!url || !token) {
    return res.status(500).json({ error: 'not_configured' });
  }
  if (!SECRET) {
    return res.status(500).json({ error: 'secret_not_configured', message: 'Defina DRIVE_SYNC_SECRET nas variáveis de ambiente da Vercel.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'bad_request' });
  }

  if (body.secret !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const files = Array.isArray(body.files) ? body.files : [];
  const redis = new Redis({ url, token });
  const current = (await redis.get(STATE_KEY)) || {};
  const updated = [];

  for (const name of files) {
    const id = idFromFilename(name);
    if (!id) continue;
    const reel = current[id] || { status: 'pendente', responsavel: '', notas: '' };
    if (reel.status === 'pendente') {
      current[id] = { ...reel, status: 'gravado', autoDetected: true, updatedAt: new Date().toISOString() };
      updated.push({ id, file: name });
    }
  }

  if (updated.length) {
    await redis.set(STATE_KEY, current);
  }

  return res.status(200).json({ ok: true, checked: files.length, updated });
}
