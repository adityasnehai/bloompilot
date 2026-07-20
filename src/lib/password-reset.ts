import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { appConfig } from "@/lib/app-config";
import { getDatabase, withTransaction } from "@/lib/database";
import { hashPassword } from "@/lib/session";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issuePasswordResetToken(email: string) {
  const database = getDatabase();
  const user = database
    .prepare(`SELECT id, email, name FROM users WHERE email = ?`)
    .get(email.trim().toLowerCase()) as { id: number; email: string; name: string } | undefined;

  if (!user) return null;

  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

  database
    .prepare(`DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ? OR used_at IS NOT NULL`)
    .run(user.id, now.toISOString());
  database
    .prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), user.id, hashToken(token), expiresAt, now.toISOString());

  return { email: user.email, name: user.name, token };
}

export async function sendPasswordResetEmail(params: { to: string; name: string; token: string }) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!resendKey || !fromEmail) return false;

  const resetUrl = new URL("/reset-password", appConfig.siteUrl);
  resetUrl.searchParams.set("token", params.token);
  const greeting = params.name.trim() || "there";

  try {
    const response = await new Resend(resendKey).emails.send({
      from: fromEmail,
      to: [params.to],
      subject: "Reset your BloomPilot password",
      text: `Hi ${greeting},\n\nUse this link to reset your BloomPilot password. It expires in 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hi ${greeting},</p><p>Use the link below to reset your BloomPilot password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });

    if (response.error) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function resetPassword(token: string, password: string) {
  const now = new Date().toISOString();
  return withTransaction((database) => {
    const row = database
      .prepare(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .get(hashToken(token), now) as { id: string; user_id: number } | undefined;

    if (!row) return false;

    const result = database
      .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .run(hashPassword(password), now, row.user_id) as { changes: number };
    if (result.changes !== 1) return false;

    database
      .prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`)
      .run(now, row.id);
    return true;
  });
}
