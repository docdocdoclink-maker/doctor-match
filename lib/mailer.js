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
      html: html || `<p>${text}</p>`,
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
      html: html || `<p>${text}</p>`,
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
