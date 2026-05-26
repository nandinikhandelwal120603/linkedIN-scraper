import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";
import { getProfile } from "./utils/supabase.js";

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
    const { role, profile } = JSON.parse(event.body);

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    const prompt = `
You are an expert cold outreach strategist and recruiter research agent.
Your task is to identify top hiring companies (top 8-10 ONLY) matching the target role, generate realistic HR/recruiter contact entries, and craft high-converting cold outreach emails.

TARGET ROLE:
${role}

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}

STRICT RULES:
1. Keep the output companies list limited to top 8-10 ONLY.
2. For each company, provide 1 or 2 HR/recruiter contacts.
3. Every email body must be under 120 words.
4. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
5. No begging tone, no long paragraphs, no resume-style listing.
6. Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

EMAIL STRUCTURE (MANDATORY):
1. HOOK (first line MUST be specific): reference company / role / something real, showing you did homework.
2. PROOF (1-2 lines): mention ONE strong project or result from candidate's projects that matches company stack/needs. Make it sound real, not buzzwords.
3. VALUE (1 line): connect candidate's work to company's needs.
4. CLOSE (1 line): soft but confident ask (e.g. "Worth a quick chat?").

OUTPUT FORMAT (STRICT JSON):
{
  "companies": [
    {
      "company_name": "string",
      "industry": "string",
      "reason_for_selection": "string",
      "hr_contacts": [
        {
          "name": "string",
          "email": "string",
          "email_confidence": "high | medium | low",
          "linkedin": "string",
          "email_content": {
            "subject": "string",
            "body": "string"
          }
        }
      ]
    }
  ]
}

Now generate the output.
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

