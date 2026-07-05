import nodemailer from "nodemailer";

// --- Dev-safe email sending ---
// No real SMTP credentials are configured for this project yet, so we use
// Nodemailer's Ethereal test-account feature: it spins up a free, no-signup
// throwaway inbox and emails aren't actually delivered anywhere real. Every
// send prints a "preview URL" to the server log where the email can be
// viewed. This lets the whole notification flow be built and demoed without
// needing anyone's real email credentials.
//
// To go live: set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS (or a
// provider SDK like Resend/SendGrid) in .env.local and swap the transport
// creation below for a real one.

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
      })
    );
  } else {
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
