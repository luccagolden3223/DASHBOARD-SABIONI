// Serverless function — called by a small Google Apps Script that runs on a
// timer and reports which filenames currently sit in the client's Drive
// folder. Any Reel whose title matches an uploaded file's name, and whose
// status is still "pendente", gets flipped to "gravado". Never downgrades or
// overwrites a Reel that's already Gravado/Editado/Publicado.
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SECRET = process.env.DRIVE_SYNC_SECRET;
const STATE_KEY = 'reels40mais:state:v1';

// id -> título exato, como aparece no dashboard (array REELS do index.html).
// Mantenha isso em sincronia se algum título mudar por lá.
const TITULOS = {
  '01': 'O erro pode não ser seu',
  '02': 'É hormônio ou é idade?',
  '03': 'A pergunta errada da consulta',
  '04': 'A pergunta que mais chega',
  '05': 'Mesmo manequim, corpo diferente',
  '06': 'O que funcionava aos 38',
  '07': 'Nem toda queda é falta de hormônio',
  '08': 'O que ninguém explica direito',
  '09': 'Três vezes na mesma semana',
  '10': 'Só a balança atrasa resultado',
  '11': 'Reposição não conserta rotina',
  '12': 'Por que sua amiga sentiu e você não',
  '13': 'A década tem regras próprias',
  '14': 'Performance na menopausa',
  '15': 'Não é ter 20 de novo',
  '16': 'Três coisas antes da receita',
  '17': 'Não é mais um remédio',
  '18': 'O que elas mais comentam',
  '19': 'Pra quem faz sentido avaliar',
  '20': 'Se você está em BH',
};

const COMBINING_MARKS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function normalize(s) {
  return String(s || '')
    .normalize('NFD').replace(COMBINING_MARKS, '') // remove acentos
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, '') // remove extensão de arquivo
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const TITULOS_NORM = Object.entries(TITULOS).map(([id, titulo]) => [id, normalize(titulo)]);

function idFromFilename(name) {
  const norm = normalize(name);
  if (!norm) return null;

  // 1) número no início do nome (compatibilidade, caso algum arquivo venha assim)
  const m = String(name).trim().match(/^0?(\d{1,2})\s*[-–—._]/) || String(name).trim().match(/^0?(\d{1,2})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) return String(n).padStart(2, '0');
  }

  // 2) correspondência exata pelo título normalizado
  const exact = TITULOS_NORM.find(([, t]) => t === norm);
  if (exact) return exact[0];

  // 3) o nome do arquivo começa com o título (sobrou algo depois, tipo "_final")
  const startsWith = TITULOS_NORM.find(([, t]) => norm.startsWith(t));
  if (startsWith) return startsWith[0];

  // 4) o título começa com o nome do arquivo (nome truncado)
  const prefix = TITULOS_NORM.find(([, t]) => t.startsWith(norm) && norm.length >= 8);
  if (prefix) return prefix[0];

  return null;
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
  const unmatched = [];

  for (const name of files) {
    const id = idFromFilename(name);
    if (!id) { unmatched.push(name); continue; }
    const reel = current[id] || { status: 'pendente', responsavel: '', notas: '' };
    if (reel.status === 'pendente') {
      current[id] = { ...reel, status: 'gravado', autoDetected: true, updatedAt: new Date().toISOString() };
      updated.push({ id, file: name });
    }
  }

  if (updated.length) {
    await redis.set(STATE_KEY, current);
  }

  return res.status(200).json({ ok: true, checked: files.length, updated, unmatched });
}
