// Roda antes de qualquer arquivo do site. Sem a liberação pelo código do e-mail,
// nenhum arquivo das pastas dos clientes (index.html, cofre.js, miniaturas...) é entregue.
import { next } from '@vercel/functions';
import { COOKIE, lerCookie, lerToken, normalizarCliente, podeAcessar } from './lib/seguranca.js';

export const config = {
  matcher: ['/((?!api/|entrar/).*)'],
};

// Liberados sem código: a raiz ("Acesso restrito"), a tela do código e as funções dela.
const PUBLICO = /^\/(api\/|entrar(\/|$)|robots\.txt$|favicon\.ico$|index\.html$|$)/;

export default function middleware(request) {
  const url = new URL(request.url);
  const caminho = url.pathname;
  if (PUBLICO.test(caminho)) return next();

  // Primeira parte do caminho = pasta do cliente. Se for estranha, vira "" e só o administrador entra.
  let primeira = caminho.split('/')[1] || '';
  try { primeira = decodeURIComponent(primeira); } catch { primeira = ''; }
  const cliente = normalizarCliente(primeira);

  let sessao = null;
  try {
    sessao = lerToken(lerCookie(request.headers.get('cookie'), COOKIE));
  } catch (e) {
    console.error('middleware', e?.message);
    return new Response('Configuração incompleta do servidor.', { status: 500 });
  }
  const liberado = Boolean(sessao && sessao.t === 's' && podeAcessar(sessao.e, cliente));

  // "/go-quadros" sem a barra final
  const pastaSemBarra = /^\/[^/]+$/.test(caminho) && !caminho.slice(1).includes('.');

  if (liberado) {
    if (pastaSemBarra) return Response.redirect(new URL(caminho + '/' + url.search, url), 308);
    return next({ headers: { 'Cache-Control': 'private, no-cache' } });
  }

  const ehPagina = pastaSemBarra || caminho.endsWith('/') || caminho.endsWith('.html');
  if (ehPagina) {
    const destino = new URL('/entrar/', url);
    if (cliente) destino.searchParams.set('c', cliente);
    destino.searchParams.set('v', (pastaSemBarra ? caminho + '/' : caminho) + url.search);
    return Response.redirect(destino, 302);
  }
  return new Response('Acesso restrito.', { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
