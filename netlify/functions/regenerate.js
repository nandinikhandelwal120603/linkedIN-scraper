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
    const { hrName, company, role, profile, previousSubject, previousBody, issues, suggestions } = JSON.parse(event.body);

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    let prompt = '';

    if (issues && Array.isArray(issues) && issues.length > 0) {
      const prevEmailText = `Subject: ${previousSubject || ''}\n\n${previousBody || ''}`;
      const issuesText = issues.join('\n');
      const suggestionsText = (suggestions || []).join('\n');

      prompt = `
You are improving a cold outreach email.

---

PREVIOUS EMAIL:
${prevEmailText}

---

ISSUES IDENTIFIED:
${issuesText}

---

SUGGESTIONS:
${suggestionsText}

---

IMPROVEMENT GOAL:

Fix ALL issues while:
- keeping it natural
- keeping it short (max 120 words)
- keeping tone confident
- utilizing candidate profile context: ${JSON.stringify(activeProfile)}

---

STRICT RULES:
- Rewrite completely (not minor edits)
- Improve hook specificity
- Strengthen proof (project + metric)
- Remove generic phrases

---

OUTPUT JSON:
{
  "subject": "string",
  "body": "string"
}
`;
    } else {
      prompt = `
You are an expert cold outreach strategist writing emails that get replies from busy recruiters and founders.
Your job is NOT to sound polite, but relevant, sharp, and builder-minded.

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}

TARGET:
Recruiter: ${hrName}
Company: ${company}
Role: ${role}

STRICT RULES:
1. Keep the email body under 120 words.
2. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
3. No begging tone, no long paragraphs, no resume-style listing.
4. Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

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
    }

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

