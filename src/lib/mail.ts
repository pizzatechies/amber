import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = env().SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export type Mail = { to: string; subject: string; text: string };

/**
 * Send a transactional email. Without SMTP_URL the message is printed to the
 * server log instead, which is what you want in local development.
 * Never throws: a mail failure must not break the action that triggered it.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.info(
      `\n[mail] (not sent: SMTP_URL is not configured)\n  To: ${mail.to}\n  Subject: ${mail.subject}\n\n${mail.text
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n")}\n`,
    );
    return;
  }
  try {
    await transport.sendMail({ from: env().MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text });
  } catch (err) {
    console.error(`[mail] failed to send "${mail.subject}" to ${mail.to}:`, err);
  }
}

const signoff = `\n\n— The ${site.name} team`;

export const mails = {
  passwordReset(to: string, name: string, link: string): Mail {
    return {
      to,
      subject: `Reset your ${site.name} password`,
      text: `Hi ${name},\n\nWe received a request to reset your password. Use the link below to choose a new one. It works once and expires in 1 hour.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password stays the same.${signoff}`,
    };
  },

  orderReceipt(to: string, name: string, order: { number: number; total: string; items: string[]; link: string }): Mail {
    return {
      to,
      subject: `Your ${site.name} receipt (order #${order.number})`,
      text: `Hi ${name},\n\nThanks for your purchase. You now have access to:\n\n${order.items
        .map((i) => `  • ${i}`)
        .join("\n")}\n\nTotal: ${order.total}\n\nStart learning: ${order.link}${signoff}`,
    };
  },

  courseReviewed(
    to: string,
    name: string,
    course: { title: string; approved: boolean; note: string; link: string },
  ): Mail {
    return {
      to,
      subject: course.approved
        ? `Your course is live: ${course.title}`
        : `Changes requested for your course: ${course.title}`,
      text: course.approved
        ? `Hi ${name},\n\nGood news — "${course.title}" passed review and is now published.\n\n${course.link}${signoff}`
        : `Hi ${name},\n\n"${course.title}" was reviewed and needs some changes before it can be published.\n\nReviewer's note:\n${course.note || "(no note provided)"}\n\nUpdate the course and submit it again when you're ready:\n${course.link}${signoff}`,
    };
  },
};
