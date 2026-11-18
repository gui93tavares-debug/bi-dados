// Envio do código pelo Resend (https://resend.com).
// Variáveis: RESEND_API_KEY e EMAIL_REMETENTE (ex.: "BI Gui Tavares <acesso@guitavaresmkt.com.br>").
import { CODIGO_MINUTOS, nomeCliente } from './seguranca.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function enviarCodigo(email, codigo, cliente) {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!chave || !remetente) {
    console.error('RESEND_API_KEY ou EMAIL_REMETENTE não configurados');
    return false;
  }
  const painel = cliente ? `o painel ${nomeCliente(cliente)}` : 'o painel';
  const texto =
    `Seu código para acessar ${painel} é ${codigo}.\n\n` +
    `Ele vale por ${CODIGO_MINUTOS} minutos. Se não foi você que pediu, ignore este e-mail.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#171b21">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #dfe3e8;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:1.5">Seu código para acessar ${esc(painel)}:</td></tr>
<tr><td style="padding:8px 28px 8px"><div style="font-size:34px;font-weight:700;letter-spacing:8px;font-family:Consolas,Menlo,monospace;color:#0e8aa3">${esc(codigo)}</div></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:13px;line-height:1.5;color:#5f6774">Ele vale por ${CODIGO_MINUTOS} minutos. Se não foi você que pediu, ignore este e-mail.</td></tr>
</table></td></tr></table></body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remetente, to: [email], subject: `${codigo} é seu código de acesso`, text: texto, html }),
    });
    if (!r.ok) {
      console.error('Resend recusou o envio', r.status, (await r.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Falha ao chamar o Resend', e?.message);
    return false;
  }
}
