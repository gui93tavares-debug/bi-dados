// Envio do código por e-mail.
// Pelo Gmail (padrão): GMAIL_USUARIO e GMAIL_SENHA_APP (senha de app do Google).
// Opcional: EMAIL_REMETENTE (ex.: "Guilherme Tavares <gui93tavares@gmail.com>"),
// SMTP_HOST e SMTP_PORTA (padrão smtp.gmail.com e 465).
// Alternativa sem Gmail: RESEND_API_KEY + EMAIL_REMETENTE.
import nodemailer from 'nodemailer';
import { CODIGO_MINUTOS, nomeCliente } from './seguranca.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function montar(codigo, cliente) {
  const painel = cliente ? `o painel ${nomeCliente(cliente)}` : 'o painel';
  const assunto = `${codigo} é seu código de acesso`;
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
  return { assunto, texto, html };
}

function smtp() {
  const porta = Number(process.env.SMTP_PORTA || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.GMAIL_USUARIO, pass: String(process.env.GMAIL_SENHA_APP || '').replace(/\s/g, '') },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function porGmail(email, m) {
  const usuario = process.env.GMAIL_USUARIO;
  try {
    await smtp().sendMail({
      from: process.env.EMAIL_REMETENTE || `Guilherme Tavares <${usuario}>`,
      to: email,
      subject: m.assunto,
      text: m.texto,
      html: m.html,
    });
    return true;
  } catch (e) {
    console.error('Gmail recusou o envio', e?.responseCode || '', String(e?.message || '').slice(0, 300));
    return false;
  }
}

async function porResend(email, m) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_REMETENTE, to: [email], subject: m.assunto, text: m.texto, html: m.html }),
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

export async function enviarCodigo(email, codigo, cliente) {
  const m = montar(codigo, cliente);
  if (process.env.GMAIL_USUARIO && process.env.GMAIL_SENHA_APP) return porGmail(email, m);
  if (process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE) return porResend(email, m);
  console.error('Nenhum envio de e-mail configurado (GMAIL_USUARIO + GMAIL_SENHA_APP)');
  return false;
}
