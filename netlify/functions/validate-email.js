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
    const { subject, body, company, role, mode } = JSON.parse(event.body || '{}');
    const activeMode = mode || 'genai';

    const prompt = `
You are a recruiter reviewing 100+ cold emails per day.

You are impatient and highly selective.

You reject emails quickly if:
- they feel generic
- they lack specificity
- they don’t show clear value

You are NOT trying to help the candidate.
You are trying to filter them out.

---

EMAIL:
Subject: ${subject || ''}
Body: ${body || ''}

TARGET:
Company: ${company || ''}
Role: ${role || ''}
Role Domain (Mode): ${activeMode}

---

EVALUATE STRICTLY:

1. HOOK QUALITY (0–25)
- Is the first line specific to THIS company/role?
- Or could it be sent to anyone?

2. PROOF STRENGTH (0–25)
- Is there ONE clear relevant project/result?
- IMPORTANT: Does the project proof match the job domain (${activeMode})? Or is there a mismatch (e.g. emailing a GenAI role but proving with a CV project)? Reject mismatch with low score.

3. RELEVANCE (0–25)
- Does it align with the role/company and domain (${activeMode})?
- Or generic AI talk?

4. TONE (0–25)
- Confident, concise, not needy, not robotic?

---

AUTO-FAIL CONDITIONS:

If ANY of these are true:
- Generic opening line
- No specific relevant project mentioned
- Project proof does not match the role domain (${activeMode})
- Email > 120 words
- Sounds like template spam

Then:
score = max 55

---

BEHAVIOR RULES:
- Be harsh, not polite
- Do NOT praise weak emails
- Call out exact problems
- Keep feedback short

---

RETURN JSON:
{
  "score": number,
  "verdict": "bad" | "okay" | "good",
  "issues": [
    "specific problems"
  ],
  "fix_suggestions": [
    "clear improvements"
  ]
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
