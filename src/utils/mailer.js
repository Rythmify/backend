// ============================================================
// utils/mailer.js — Nodemailer transporter + email templates
// Uses Gmail App Password 
// ============================================================
const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.GMAIL_USER,
    pass: env.GMAIL_APP_PASSWORD,
  },
});


const baseTemplate = ({ title, previewText, bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

 
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}</span>


  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f0f;padding:40px 16px;">
    <tr>
      <td align="center">

      
        <table width="520" cellpadding="0" cellspacing="0" border="0"
               style="background-color:#1a1a1a;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">

         
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);padding:36px 40px;text-align:center;">
             
              <div style="display:inline-block;">
                <span style="font-size:36px;line-height:1;">🎵</span>
                <div style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-top:6px;">
                  Rythmify
                </div>
              </div>
            </td>
          </tr>

          
          <tr>
            <td style="padding:40px 40px 32px;color:#e5e5e5;">
              ${bodyContent}
            </td>
          </tr>

        
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                If you didn't create a Rythmify account, you can safely ignore this email.<br/>
                &copy; ${new Date().getFullYear()} Rythmify. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      

      </td>
    </tr>
  </table>

</body>
</html>
`;

// Reusable call to action button component for all emails
const ctaButton = (href, label) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
    <tr>
      <td align="center">
        <a href="${href}" target="_blank"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);
                  color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;
                  padding:14px 40px;border-radius:50px;letter-spacing:0.3px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
  <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
    Button not working? Copy and paste this link into your browser:<br/>
    <a href="${href}" style="color:#7c3aed;word-break:break-all;">${href}</a>
  </p>
`;

// verify email
const sendVerificationEmail = async (to, { displayName, token }) => {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;

  const bodyContent = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
      Verify your email 
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#aaaaaa;line-height:1.6;">
      Hello <strong style="color:#ffffff;">${displayName}</strong>,
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#aaaaaa;line-height:1.6;">
      Welcome to Rythmify! To finish setting up your account, please verify your
      email address by clicking the button below.
    </p>
    ${ctaButton(link, 'Verify Email Address')}
    <p style="margin:24px 0 0;font-size:13px;color:#555555;text-align:center;">
      This link expires in <strong style="color:#aaaaaa;">24 hours</strong>.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'Verify your Rythmify account',
    html: baseTemplate({
      title: 'Verify your Rythmify account',
      previewText: 'One click away — verify your email to start listening.',
      bodyContent,
    }),
  });
};

// resend verification email
const sendResendVerificationEmail = async (to, { displayName, token }) => {
  const link = `${env.CLIENT_URL}/verify-email?token=${token}`;

  const bodyContent = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
      New verification link
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#aaaaaa;line-height:1.6;">
      Hello <strong style="color:#ffffff;">${displayName}</strong>,
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#aaaaaa;line-height:1.6;">
      Here's your new email verification link. Your previous link has been invalidated.
    </p>
    ${ctaButton(link, 'Verify Email Address')}
    <p style="margin:24px 0 0;font-size:13px;color:#555555;text-align:center;">
      This link expires in <strong style="color:#aaaaaa;">24 hours</strong>.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'New verification link — Rythmify',
    html: baseTemplate({
      title: 'New verification link',
      previewText: 'Your new Rythmify verification link is ready.',
      bodyContent,
    }),
  });
};

// password reset email
const sendPasswordResetEmail = async (to, { displayName, token }) => {
  const link = `${env.CLIENT_URL}/reset-password?token=${token}`;

  const bodyContent = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">
      Reset your password 
    </h1>
    <p style="margin:0 0 4px;font-size:15px;color:#aaaaaa;line-height:1.6;">
      Hello <strong style="color:#ffffff;">${displayName}</strong>,
    </p>
    <p style="margin:12px 0 0;font-size:15px;color:#aaaaaa;line-height:1.6;">
      We received a request to reset your Rythmify password.
      Click the button below to choose a new one.
    </p>
    ${ctaButton(link, 'Reset Password')}
    <p style="margin:24px 0 0;font-size:13px;color:#555555;text-align:center;">
      This link expires in <strong style="color:#aaaaaa;">1 hour</strong>.
      If you didn't request this, no action is needed.
    </p>
  `;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Rythmify password',
    html: baseTemplate({
      title: 'Reset your Rythmify password',
      previewText: 'Reset your Rythmify password — link expires in 1 hour.',
      bodyContent,
    }),
  });
};

module.exports = {
  sendVerificationEmail,
  sendResendVerificationEmail,
  sendPasswordResetEmail,
};