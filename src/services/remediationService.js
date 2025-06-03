const dotenv = require('dotenv');
const OpenAI = require('openai');

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

async function generateRemediation(violations) {
  const remediations = [];

  for (const v of violations) {
    const prompt = `
You are a Terraform compliance assistant.
Violation: ${v.message}
Terraform Resource:
${v.resourceSnippet || JSON.stringify(v.resource, null, 2)}

Return a JSON with explanation and a fixed Terraform code snippet.
`;

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ]
    });

    remediations.push({
      violationId: v.id,
      resource: v.resourceId,
      suggestion: completion.choices[0].message.content
    });
  }

  return remediations;
}

module.exports = { generateRemediation };
