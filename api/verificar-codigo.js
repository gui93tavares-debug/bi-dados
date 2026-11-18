// POST {token, codigo, destino} → confere o código e libera o navegador por alguns dias.
import { ipAddress } from '@vercel/functions';
import {
  MAX_TENTATIVAS, SESSAO_DIAS, codigoConfere, cookieSessao, criarToken,
  destinoSeguro, json, lerToken, podeAcessar,
} from '../lib/seguranca.js';
import { gravar, ler, somar } from '../lib/contador.js';

const JANELA = 15 * 60;

export async function POST(request) {
  try {
    let corpo;
    try { corpo = await request.json(); } catch { return json({ erro: 'Pedido inválido.' }, 400); }

    const ip = ipAddress(request) || 'sem-ip';
    if ((await somar(`verif-ip:${ip}`, JANELA)) > 60) {
      return json({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }, 429);
    }

    const token = String(corpo?.token || '');
    const dados = lerToken(token);
    const expirado = { erro: 'Este código expirou. Peça um novo.', novo: true };
    if (!dados || dados.t !== 'c') return json(expirado, 400);
    if (await ler(`usado:${dados.n}`)) return json(expirado, 400);

    const tentativa = await somar(`tent:${dados.n}`, JANELA);
    if (tentativa > MAX_TENTATIVAS) {
      return json({ erro: 'Muitas tentativas com este código. Peça um novo.', novo: true }, 429);
    }

    if (!podeAcessar(dados.e, dados.c) || !codigoConfere(token, corpo?.codigo)) {
      const restam = MAX_TENTATIVAS - tentativa;
      return json({
        erro: restam > 0 ? `Código incorreto. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}.` : 'Código incorreto. Peça um novo.',
        novo: restam <= 0,
      }, 400);
    }

    await gravar(`usado:${dados.n}`, 1, JANELA);
    const segundos = SESSAO_DIAS * 24 * 60 * 60;
    const sessao = criarToken({ t: 's', e: dados.e, x: Date.now() + segundos * 1000 });
    return json(
      { ok: true, destino: destinoSeguro(corpo?.destino, dados.c) },
      200,
      { 'Set-Cookie': cookieSessao(sessao, segundos) },
    );
  } catch (e) {
    console.error('verificar-codigo', e?.message);
    return json({ erro: 'Erro no servidor. Tente de novo em instantes.' }, 500);
  }
}
