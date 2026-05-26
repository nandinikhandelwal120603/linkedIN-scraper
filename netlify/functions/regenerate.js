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
    const { hrName, company, role, profile } = JSON.parse(event.body);

    const prompt = `
You are an expert cold outreach strategist writing emails that get replies from busy recruiters and founders.
Your job is NOT to sound polite, but relevant, sharp, and builder-minded.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

TARGET:
Recruiter: ${hrName}
Company: ${company}
Role: ${role}

STRICT RULES:
1. Keep the email body under 120 words.
2. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
3. No begging tone, no long paragraphs, no resume-style listing.
4. Tone: ${profile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

EMAIL STRUCTURE (MANDATORY):
1. HOOK (first line MUST be specific): reference company / role / something real, showing you did homework.
2. PROOF (1-2 lines): mention ONE strong project or result from candidate's projects that matches company stack/needs.
3. VALUE (1 line): connect candidate's work to company's needs.
4. CLOSE (1 line): soft but confident ask (e.g. "Worth a quick chat?").

OUTPUT FORMAT (STRICT JSON):
{
  "subject": "string",
  "body": "string"
}

Now regenerate the best possible email.
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

