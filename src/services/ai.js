// ai.js
require('dotenv').config();

async function getRemediationSuggestion(violation) {
  const payload = {
    model: 'deepseek-chat',
    messages: [
      {
        role: "system",
        content: "You are a cloud compliance expert. Provide a short and actionable remediation for each cloud compliance issue."
      },
      {
        role: "user",
        content: `Suggest a remediation for this issue:\n\nResource Type: ${violation.resource_type}\nMessage: ${violation.message}`
      }
    ],
    temperature: 0.5,
    max_tokens: 256
  };

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || 'No remediation suggestion returned.';
  } catch (err) {
    console.error('Failed to fetch remediation:', err.message);
    return 'Remediation service unavailable.';
  }
}

module.exports = { getRemediationSuggestion };
