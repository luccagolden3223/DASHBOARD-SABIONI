// Serverless function (Vercel) — shared status store for the Reels 40+ dashboard.
// Backed by Redis via the "Upstash for Redis" integration in Vercel Storage.
// Works with either the current env var names (UPSTASH_REDIS_REST_*) or the
// older Vercel KV names (KV_REST_API_*), whichever the integration injects.
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const REEL_IDS = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
const STATE_KEY = 'reels40mais:state:v1';

function defaultState() {
  const obj = {};
  REEL_IDS.forEach((id) => { obj[id] = { status: 'pendente', responsavel: '', notas: '' }; });
  return obj;
}

export default async function handler(req, res) {
  if (!url || !token) {
    return res.status(500).json({
      error: 'not_configured',
      message: 'Faltam as variáveis de ambiente do Redis. Adicione um banco na aba Storage do projeto na Vercel.',
    });
  }
  const redis = new Redis({ url, token });

  try {
    if (req.method === 'GET') {
      const data = (await redis.get(STATE_KEY)) || defaultState();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { id, patch } = body;
      if (!id || !REEL_IDS.includes(id) || typeof patch !== 'object' || patch === null) {
        return res.status(400).json({ error: 'bad_request' });
      }
      const current = (await redis.get(STATE_KEY)) || defaultState();
      current[id] = {
        status: 'pendente',
        responsavel: '',
        notas: '',
        ...current[id],
        ...patch,
      };
      await redis.set(STATE_KEY, current);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(current);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('reels api error', e);
    return res.status(500).json({ error: 'server_error', message: String((e && e.message) || e) });
  }
}
