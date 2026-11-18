// Contadores com prazo (limite de envios e de tentativas), no Runtime Cache da Vercel.
// Se o cache não estiver disponível, usa a memória da própria função.
import { getCache } from '@vercel/functions';

const memoria = new Map();

function cache() {
  try { return getCache({ namespace: 'bi2fa' }); } catch { return null; }
}

function memoriaLer(chave) {
  const item = memoria.get(chave);
  if (!item || item.ate < Date.now()) { memoria.delete(chave); return null; }
  return item.valor;
}

export async function ler(chave) {
  const c = cache();
  if (c) {
    try { return await c.get(chave); } catch (e) { console.error('cache.get', e?.message); }
  }
  return memoriaLer(chave);
}

export async function gravar(chave, valor, segundos) {
  memoria.set(chave, { valor, ate: Date.now() + segundos * 1000 });
  const c = cache();
  if (c) {
    try { await c.set(chave, valor, { ttl: segundos }); } catch (e) { console.error('cache.set', e?.message); }
  }
}

export async function somar(chave, segundos) {
  const n = Number((await ler(chave)) || 0) + 1;
  await gravar(chave, n, segundos);
  return n;
}
