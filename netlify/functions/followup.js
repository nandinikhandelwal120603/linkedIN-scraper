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
    const { hrName, company, role, profile, previousSubject, previousBody } = JSON.parse(event.body);

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    const prompt = `
You are an expert cold outreach strategist writing follow-up emails that get replies from recruiters.

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}

TARGET:
Recruiter: ${hrName}
Company: ${company}
Role: ${role}

PREVIOUS EMAIL SENT:
Subject: ${previousSubject}
Body:
${previousBody}

STRICT RULES:
1. Keep it extremely short (under 50 words).
2. Do not write a long paragraph. 1 or 2 lines max.
3. Bring value or politely bump the previous conversation (e.g. "Just bumping this to see if you have 10 mins next week?").
4. Tone: ${activeProfile?.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

OUTPUT FORMAT (STRICT JSON):
{
  "subject": "string",
  "body": "string"
}

Now generate the follow-up email.
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

