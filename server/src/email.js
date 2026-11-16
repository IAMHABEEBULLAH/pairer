// Sends email over HTTPS. Render's free web services block SMTP ports, so an HTTP API is the reliable way.
// Supported providers (set one): Brevo (BREVO_API_KEY) or Resend (RESEND_API_KEY).
// EMAIL_FROM is the sender, for example: Parer <hello@yourdomain.com> or just you@yourdomain.com
import { isProd } from './env.js';

const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';

export const emailConfigured = () => Boolean(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY);

// The base URL used inside emails. Never taken from the request's Host header,
// because an attacker could forge it and point reset links at their own site.
export function appUrl() {
  const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
  return url.replace(/\/+$/, '');
}

function parseFrom(from) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || '');
  return m ? { name: m[1] || 'Parer', email: m[2].trim() } : { name: 'Parer', email: (from || '').trim() };
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`Email provider returned ${res.status}: ${detail}`);
  }
}

export async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM;

  if (process.env.BREVO_API_KEY) {
    if (!from) throw new Error('EMAIL_FROM is not set.');
    await postJson(BREVO_URL, { 'api-key': process.env.BREVO_API_KEY }, {
      sender: parseFrom(from),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    });
    return;
  }

  if (process.env.RESEND_API_KEY) {
    if (!from) throw new Error('EMAIL_FROM is not set.');
    await postJson(RESEND_URL, { authorization: `Bearer ${process.env.RESEND_API_KEY}` }, {
      from,
      to: [to],
      subject,
      html,
      text,
    });
    return;
  }

  if (!isProd) {
    // Local development: print the email so you can click the link without an email provider.
    console.log(`\n--- email (not sent: no provider configured) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }
  throw new Error('No email provider is configured (set BREVO_API_KEY or RESEND_API_KEY).');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function resetEmail({ name, link, minutes }) {
  const first = name.split(' ')[0];
  const text =
    `Hi ${first},\n\n` +
    `Someone asked to reset the password for your Parer account. Use this link to choose a new one:\n\n${link}\n\n` +
    `The link works once and expires in ${minutes} minutes.\n\n` +
    `If you did not ask for this, you can ignore this email. Your password has not changed.\n\nParer`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#132b22;line-height:1.5">` +
    `<h2 style="margin:0 0 16px">Reset your Parer password</h2>` +
    `<p>Hi ${esc(first)},</p>` +
    `<p>Someone asked to reset the password for your Parer account. Use the button to choose a new one.</p>` +
    `<p style="margin:24px 0"><a href="${esc(link)}" style="background:#8fc93f;color:#132b22;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>` +
    `<p style="font-size:14px">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>` +
    `<p style="font-size:14px;color:#555">The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this email. Your password has not changed.</p>` +
    `</div>`;
  return { subject: 'Reset your Parer password', text, html };
}
