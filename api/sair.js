// GET /api/sair → apaga a liberação deste navegador e volta para a tela do código.
import { COOKIE } from '../lib/seguranca.js';

export function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/entrar/',
      'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
}
