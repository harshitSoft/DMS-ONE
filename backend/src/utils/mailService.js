require("dotenv").config();
const nodemailer = require("nodemailer");

let transporter;
let verificationPromise;

function getMailConfig() {
  const user = String(process.env.MAIL_USER || "").trim();
  const pass = String(process.env.MAIL_PASS || "").replace(/\s/g, "");
  if (!user || !pass) {
    const error = new Error("Mail service is not configured");
    error.status = 500;
    throw error;
  }
  return {
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT) || 587,
    user,
    pass,
    from: process.env.MAIL_FROM || `"DMS Security" <${user}>`
  };
}

function getTransporter() {
  if (transporter) return transporter;
  const config = getMailConfig();
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
  return transporter;
}

function logMailError(error) {
  console.error("Mail send failed:", {
    code: error.code,
    command: error.command,
    response: error.response,
    responseCode: error.responseCode
  });
}

function mailError(error) {
  logMailError(error);
  const message = process.env.NODE_ENV === "production"
    ? "Unable to send OTP email. Please contact support."
    : "Email sending failed. Check SMTP credentials or Gmail App Password.";
  const safeError = new Error(message);
  safeError.status = 500;
  return safeError;
}

async function verifyTransport() {
  if (!verificationPromise) {
    verificationPromise = getTransporter().verify().catch((error) => {
      verificationPromise = null;
      throw error;
    });
  }
  return verificationPromise;
}

async function verifyMailTransport() {
  try {
    return await verifyTransport();
  } catch (error) {
    throw mailError(error);
  }
}

async function sendMail(options) {
  try {
    await verifyTransport();
    const config = getMailConfig();
    return await getTransporter().sendMail({ from: config.from, ...options });
  } catch (error) {
    throw mailError(error);
  }
}

async function sendLoginOtpEmail({ to, name, otp }) {
  const text = `Hello ${name || "User"},

Your DMS login verification code is:

${otp}

This code is valid for 10 minutes.

If you did not request this, please ignore this email.

Regards,
DMS Security Team`;

  return sendMail({
    to,
    subject: "DMS Login Verification Code",
    text,
    html: `<p>Hello ${name || "User"},</p><p>Your DMS login verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code is valid for 10 minutes.</p><p>If you did not request this, please ignore this email.</p><p>Regards,<br>DMS Security Team</p>`
  });
}

async function sendPasswordChangeOtpEmail({ to, name, otp }) {
  const text = `Hello ${name || "User"},

Your DMS password change verification code is:

${otp}

This code is valid for 10 minutes.

If you did not request a password change, please contact your administrator immediately.

Regards,
DMS Security Team`;

  return sendMail({
    to,
    subject: "DMS Password Change Verification Code",
    text,
    html: `<p>Hello ${name || "User"},</p><p>Your DMS password change verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code is valid for 10 minutes.</p><p>If you did not request a password change, please contact your administrator immediately.</p><p>Regards,<br>DMS Security Team</p>`
  });
}

async function sendForgotPasswordOtpEmail({ to, name, otp }) {
  const text = `Hello ${name || "User"},

Your DMS password recovery OTP is:

${otp}

This OTP is valid for 10 minutes.

If you did not request this, please ignore this email.

Regards,
DMS Security Team`;

  return sendMail({
    to,
    subject: "DMS Password Recovery OTP",
    text,
    html: `<p>Hello ${name || "User"},</p><p>Your DMS password recovery OTP is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This OTP is valid for 10 minutes.</p><p>If you did not request this, please ignore this email.</p><p>Regards,<br>DMS Security Team</p>`
  });
}

async function sendTestEmail() {
  const config = getMailConfig();
  return sendMail({
    to: config.user,
    subject: "DMS SMTP Test",
    text: "DMS SMTP configuration is working correctly.",
    html: "<p><strong>DMS SMTP configuration is working correctly.</strong></p>"
  });
}

module.exports = {
  verifyMailTransport,
  sendTestEmail,
  sendLoginOtpEmail,
  sendPasswordChangeOtpEmail,
  sendForgotPasswordOtpEmail
};
