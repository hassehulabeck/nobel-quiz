import { Resend } from "resend";

const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? "Nobel Quiz <onboarding@resend.dev>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

async function sendEmail(to: string, subject: string, html: string) {
  const resend = getResendClient();

  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not configured");
    }
    // Local dev fallback until task 0.3 (Resend API key) is wired up —
    // see TASKS.md. Logs instead of sending so the auth flow is still
    // testable end-to-end without real credentials.
    console.log(
      `[email:dev-fallback] to=${to} subject=${JSON.stringify(subject)}\n${html}`
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await sendEmail(
    to,
    "Verify your Nobel Quiz account",
    `<p>Welcome to Nobel Quiz! Click the link below to verify your email address:</p>
     <p><a href="${verifyUrl}">${verifyUrl}</a></p>
     <p>This link expires in 24 hours.</p>`
  );
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendEmail(
    to,
    "Reset your Nobel Quiz password",
    `<p>Someone requested a password reset for this account. If that was you, click the link below:</p>
     <p><a href="${resetUrl}">${resetUrl}</a></p>
     <p>If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>`
  );
}
