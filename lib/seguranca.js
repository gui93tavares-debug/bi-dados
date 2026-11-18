// Verificação por código no e-mail (segunda etapa antes do login da dash).
// Nada aqui é segredo: o segredo fica na variável SEGREDO_2FA da Vercel,
// e a lista de quem acessa cada cliente fica na variável ACESSOS.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'bi_sessao';
export const SESSAO_DIAS = 7;        // quantos dias o navegador fica liberado
export const CODIGO_MINUTOS = 10;    // validade do código
export const MAX_TENTATIVAS = 5;     // tentativas por código

function segredo() {
  const s = process.env.SEGREDO_2FA || '';
  if (s.length < 32) throw new Error('SEGREDO_2FA ausente ou com menos de 32 caracteres');
  return s;
}

function assinar(texto) {
  return createHmac('sha256', segredo()).update(texto).digest('base64url');
}

function iguais(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
}

// Token assinado: <dados em base64url>.<assinatura>
export function criarToken(dados) {
  const p = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return p + '.' + assinar('v1|' + p);
}

export function lerToken(token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const i = token.indexOf('.');
  if (i < 1) return null;
  const p = token.slice(0, i);
  if (!iguais(token.slice(i + 1), assinar('v1|' + p))) return null;
  let dados;
  try { dados = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); } catch { return null; }
  if (!dados || typeof dados.x !== 'number' || dados.x < Date.now()) return null;
  return dados;
}

// O código de 6 dígitos sai do próprio token: nada precisa ser guardado.
export function codigoDoToken(token) {
  const h = createHmac('sha256', segredo()).update('codigo|' + token).digest();
  return String(h.readUInt32BE(0) % 1000000).padStart(6, '0');
}

export function codigoConfere(token, codigo) {
  return iguais(codigoDoToken(token), String(codigo || '').replace(/\D/g, ''));
}

export function normalizarEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function emailValido(e) {
  return e.length <= 254 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// Pasta do cliente: só letras minúsculas, números e hífen. Qualquer outra coisa vira "".
export function normalizarCliente(c) {
  const s = String(c || '').trim().toLowerCase();
  return /^[a-z0-9-]{1,60}$/.test(s) ? s : '';
}

export function nomeCliente(c) {
  if (!c) return '';
  return c.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ACESSOS = {"*": ["admin@..."], "go-quadros": ["contato@goquadros.com.br"], ...}
// "*" acessa todos os clientes. Pasta fora da lista: só quem está em "*".
function acessos() {
  try {
    const o = JSON.parse(process.env.ACESSOS || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    console.error('ACESSOS não é um JSON válido');
    return {};
  }
}

export function podeAcessar(email, cliente) {
  const a = acessos();
  const lista = (l) => (Array.isArray(l) ? l.map(normalizarEmail) : []);
  if (lista(a['*']).includes(email)) return true;
  return Boolean(cliente) && lista(a[cliente]).includes(email);
}

export function lerCookie(cabecalho, nome) {
  for (const parte of String(cabecalho || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) return parte.slice(i + 1).trim();
  }
  return null;
}

export function cookieSessao(token, segundos) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
}

// Para onde voltar depois do código: só caminhos deste site.
export function destinoSeguro(v, cliente) {
  const s = String(v || '');
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\') || /[\r\n\t]/.test(s) || s.length > 500) {
    return cliente ? `/${cliente}/` : '/';
  }
  return s;
}

export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabecalhos },
  });
}
