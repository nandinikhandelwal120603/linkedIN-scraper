import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { previousEmail, company, role, userProfile } = JSON.parse(event.body);

    const prompt = `
Write a short follow-up email.

Previous: ${previousEmail}
Company: ${company}
Role: ${role}
Profile: ${userProfile}

Return JSON:
{
  "subject":"",
  "body":""
}
`;

    const raw = await callGemini(prompt);
    const parsed = safeParse(raw);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: err.message }) 
    };
  }
}
