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
    const { company, role, hr_title, email, email_score, mode } = JSON.parse(event.body || '{}');
    const activeMode = mode || 'genai';

    const prompt = `
You are evaluating whether a job outreach lead is worth emailing.

Your goal:
Prioritize leads with the highest chance of reply.

---

LEAD INFO:

Company: ${company || ''}
Role: ${role || ''}
Role Domain (Mode): ${activeMode}
HR Title: ${hr_title || 'Recruiter'}
Email Score: ${email_score || 80}

---

EVALUATE:

1. COMPANY TYPE (0–25)
- Startup / small team → high
- Mid-size → medium
- Big tech / corporate → low

2. ROLE RELEVANCE & DOMAIN MATCH (0–25)
- Does candidate profile strongly match this role domain (${activeMode})?
- Direct match → high
- Partial match → medium
- Weak → low

3. DECISION MAKER PROXIMITY (0–25)
- Founder / Hiring Manager → high
- Engineer / Team Lead → medium
- Generic HR → low

4. EMAIL QUALITY SCORE (0–25)
- Use given email_score (normalize the score from 0-100 down to 0-25)

---

BEHAVIOR RULES:

- Be practical, not optimistic
- Prefer startups over big companies
- Prefer builders over HR
- Be selective

---

RETURN JSON:

{
  "lead_score": number,
  "priority": "high" | "medium" | "low",
  "reason": "short explanation"
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
