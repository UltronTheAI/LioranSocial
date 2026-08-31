import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'LioranSocial <noreply@lioransocial.app>';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    return transporter;
  }

  return null;
}

/**
 * Sends a 6-digit OTP verification email
 */
export async function sendVerificationEmail(to: string, otp: string): Promise<boolean> {
  const mailer = getTransporter();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
        .container { max-width: 480px; margin: 40px auto; padding: 32px; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; }
        .header { text-align: center; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; }
        .subtitle { font-size: 14px; color: #a1a1aa; line-height: 1.5; margin: 0; }
        .otp-box { background-color: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
        .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: monospace; }
        .footer { font-size: 12px; color: #71717a; text-align: center; margin-top: 24px; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Verify Your Account</h1>
          <p class="subtitle">Enter the 6-digit code below to verify your email and complete your registration.</p>
        </div>
        <div class="otp-box">
          <span class="otp-code">${otp}</span>
        </div>
        <p class="subtitle" style="text-align: center;">This code will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} LioranSocial. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your LioranSocial verification code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  if (!mailer) {
    console.log('\n========================================');
    console.log(`[EMAIL SERVICE] (DEV MODE - SMTP Not Configured)`);
    console.log(`To: ${to}`);
    console.log(`Subject: Verify your LioranSocial account`);
    console.log(`Verification OTP: [ ${otp} ]`);
    console.log('========================================\n');
    return true;
  }

  try {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `${otp} is your LioranSocial verification code`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email via SMTP:', error);
    // In dev, log to console so testing is never blocked
    console.log(`[EMAIL SERVICE FALLBACK] Verification OTP for ${to}: [ ${otp} ]`);
    return false;
  }
}

/**
 * Sends a password reset OTP / instructions email
 */
export async function sendPasswordResetEmail(to: string, otp: string): Promise<boolean> {
  const mailer = getTransporter();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
        .container { max-width: 480px; margin: 40px auto; padding: 32px; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; }
        .header { text-align: center; margin-bottom: 24px; }
        .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; }
        .subtitle { font-size: 14px; color: #a1a1aa; line-height: 1.5; margin: 0; }
        .otp-box { background-color: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0; }
        .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: monospace; }
        .footer { font-size: 12px; color: #71717a; text-align: center; margin-top: 24px; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">Reset Your Password</h1>
          <p class="subtitle">Use the verification code below to reset the password for your LioranSocial account.</p>
        </div>
        <div class="otp-box">
          <span class="otp-code">${otp}</span>
        </div>
        <p class="subtitle" style="text-align: center;">This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} LioranSocial. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your LioranSocial password reset code is: ${otp}\n\nThis code will expire in 10 minutes.`;

  if (!mailer) {
    console.log('\n========================================');
    console.log(`[EMAIL SERVICE] (DEV MODE - SMTP Not Configured)`);
    console.log(`To: ${to}`);
    console.log(`Subject: Reset your LioranSocial password`);
    console.log(`Password Reset OTP: [ ${otp} ]`);
    console.log('========================================\n');
    return true;
  }

  try {
    await mailer.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `${otp} is your password reset code`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email via SMTP:', error);
    console.log(`[EMAIL SERVICE FALLBACK] Password reset OTP for ${to}: [ ${otp} ]`);
    return false;
  }
}
