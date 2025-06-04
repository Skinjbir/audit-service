const axios = require('axios');

const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@yourdomain.com';

async function sendEmail(to, subject, html) {
  const data = {
    from: {
      email: FROM_EMAIL,
      name: 'PFS Audit System',
    },
    to: [{ email: to }],
    subject,
    html,
  };

  try {
    await axios.post('https://api.mailersend.com/v1/email', data, {
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('MailerSend error:', error.response?.data || error.message);
    throw new Error('MailerSend failed to send email');
  }
}

module.exports = { sendEmail };
