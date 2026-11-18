// POST {cliente, email} → envia o código (se o e-mail tiver acesso) e devolve um token.
// A resposta é igual para e-mails com e sem acesso, para não revelar quem está na lista.
import { randomBytes, randomInt } from 'node:crypto';
import { ipAddress } from '@vercel/functions';
import {
  CODIGO_MINUTOS, criarToken, codigoDoToken, emailValido, json,
  normalizarCliente, normalizarEmail, podeAcessar,
} from '../lib/seguranca.js';
import { somar } from '../lib/contador.js';
import { enviarCodigo } from '../lib/email.js';

const JANELA = 15 * 60; // 15 minutos
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(request) {
  try {
    let corpo;
    try { corpo = await request.json(); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    const email = normalizarEmail(corpo?.email);
    const cliente = normalizarCliente(corpo?.cliente);
    if (!emailValido(email)) return json({ erro: 'Confira o e-mail digitado.' }, 400);

    const ip = ipAddress(request) || 'sem-ip';
    const muitas = { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' };
    if ((await somar(`envio-ip:${ip}`, JANELA)) > 30) return json(muitas, 429);
    if ((await somar(`envio-email:${email}`, JANELA)) > 5) return json(muitas, 429);

    const token = criarToken({
      t: 'c', e: email, c: cliente,
      n: randomBytes(12).toString('base64url'),
      x: Date.now() + CODIGO_MINUTOS * 60 * 1000,
    });

    if (podeAcessar(email, cliente)) {
      const ok = await enviarCodigo(email, codigoDoToken(token), cliente);
      if (!ok) return json({ erro: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' }, 502);
    } else {
      await espera(400 + randomInt(600)); // mesmo tempo de resposta de um envio real
    }
    return json({ ok: true, token, minutos: CODIGO_MINUTOS });
  } catch (e) {
    console.error('enviar-codigo', e?.message);
    return json({ erro: 'Erro no servidor. Tente de novo em instantes.' }, 500);
  }
}
