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
- Startup / small team → 23 - 25 points
- Mid-size / growing companies → 20 - 22 points
- Big tech / corporate → 15 - 19 points

2. ROLE RELEVANCE & DOMAIN MATCH (0–25)
- Direct match → 23 - 25 points
- Partial match → 18 - 22 points
- Weak match → 10 - 17 points

3. DECISION MAKER PROXIMITY (0–25)
- Founder / Hiring Manager / Tech Recruiter / Talent Acquisition → 23 - 25 points
- Engineer / Team Lead / General Recruiter → 18 - 22 points
- Generic HR / other roles → 12 - 17 points

4. EMAIL QUALITY SCORE (0–25)
- Use given email_score (normalize the score from 0-100 down to 0-25)

---

BEHAVIOR RULES:

- Be optimistic and encouraging. If a lead has a valid email, matches the role, and is actively hiring, give a higher lead score (aim for 75-95 overall).
- Do not artificially penalize valid recruiter/HR contacts or mid/large companies just because they are not tiny startups. Tech recruiters and mid/large companies are highly valuable targets.

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
