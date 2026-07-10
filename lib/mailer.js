import dns from "node:dns";
import nodemailer from "nodemailer";

// Railway's containers can resolve IPv6 addresses (Gmail's, Resend's/
// Cloudflare's) but can't actually route to them (ENETUNREACH). Node's
// default DNS lookup order can return those IPv6 addresses first for
// dual-stack hosts, which breaks both nodemailer's SMTP connection and the
// native fetch() call to Resend below. Preferring IPv4 process-wide avoids
// that for every outbound connection, not just the ones we remember to pass
// `family: 4` to individually.
dns.setDefaultResultOrder("ipv4first");

// --- Email sending ---
// Railway blocks outbound SMTP entirely on the Hobby plan, so Resend (an
// HTTPS API, not SMTP — not subject to that block) is the real transport in
// production. It sends as an address @doclink.jp once that domain is
// verified in the Resend dashboard.
//
// SMTP_HOST is kept as a fallback for environments where SMTP isn't blocked
// (e.g. running this outside Railway). If neither is configured, fall back
// to a throwaway Ethereal test inbox so local dev still works without any
// credentials — nothing is actually delivered in that case, just logged.

const RESEND_FROM = process.env.RESEND_FROM || '"DocLink" <notify@doclink.jp>';

// Wraps plain text in a branded HTML shell (logo header + footer) so emails
// don't look like unstyled system output. Used whenever a call site doesn't
// supply its own `html`. Line breaks in the source text become <br>, and
// blank lines become paragraph breaks.
function wrapEmailHtml(text) {
  const escaped = (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const body = escaped
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 16px;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#0d1b33; padding:24px 28px;">
                <span style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:0.3px;">Doc<span style="color:#5b9bff;">Link</span></span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px; color:#1f2937; font-size:14px; line-height:1.7;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px; background:#f9fafb; border-top:1px solid #e5e7eb; color:#9ca3af; font-size:11px; line-height:1.6;">
                このメールはDocLink（医師・病院マッチングサービス）から自動送信されています。心当たりがない場合は本メールを破棄してください。
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendViaResend({ to, subject, text, html, replyTo }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text,
      html: html || wrapEmailHtml(text),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Resend API error (${res.status})`);
  }
  return data;
}

let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
        // Railway's containers can resolve Gmail's IPv6 addresses but can't
        // actually route to them (ENETUNREACH), so force IPv4 for the
        // connection instead of letting Node pick whichever address family
        // DNS returns first.
        family: 4,
      })
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[mailer] SMTP_HOST is not set — falling back to a throwaway Ethereal test inbox. " +
        "No email will actually reach any real address (admin notifications included) until " +
        "SMTP_HOST/SMTP_USER/SMTP_PASS are set in this environment's variables."
    );
    transporterPromise = nodemailer.createTestAccount().then((account) =>
      nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      })
    );
  }
  return transporterPromise;
}

export async function sendMail({ to, subject, text, html, replyTo }) {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, text, html, replyTo });
      // eslint-disable-next-line no-console
      console.log(`[mailer] "${subject}" to ${to} -> sent via Resend`);
      return { ok: true };
    }

    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: '"DocLink" <docdocdoclink@gmail.com>',
      to,
      subject,
      text,
      html: html || wrapEmailHtml(text),
      ...(replyTo ? { replyTo } : {}),
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      // eslint-disable-next-line no-console
      console.log(`[mailer] "${subject}" to ${to} -> preview: ${previewUrl}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[mailer] "${subject}" to ${to} -> sent via ${process.env.SMTP_HOST}`);
    }
    return { ok: true, previewUrl };
  } catch (e) {
    // Email is a best-effort side effect; never let it break the request that
    // triggered it (e.g. sending a chat message should still succeed).
    // eslint-disable-next-line no-console
    console.error("[mailer] send failed:", e.message);
    return { ok: false, error: e.message };
  }
}
