import { callGemini } from "../services/gemini.js";
import { safeParse } from "../services/parser.js";

/**
 * Builds the Email Regeneration Prompt
 */
function buildRegenPrompt(hrName, company, role, userProfile) {
  return `
You are improving a cold email for job outreach.

INPUT:
Name: ${hrName}
Company: ${company}
Role: ${role}
User Background: ${userProfile}

Rewrite the email with:
- More personalization
- Stronger opening line
- Specific value proposition
- Confident tone

STRICT OUTPUT:
{
  "subject": "string",
  "body": "string"
}

Keep it under 120 words.
No extra text.
`;
}

/**
 * Express Route Handler: POST /api/regenerate
 */
export default async function handler(req, res) {
  try {
    const { hrName, company, role, userProfile, geminiKeyOverride } = req.body;

    if (!hrName || !company || !role || !userProfile) {
      return res.status(400).json({ error: "Missing required parameters (hrName, company, role, userProfile)." });
    }

    const promptText = buildRegenPrompt(hrName, company, role, userProfile);
    const raw = await callGemini(promptText, geminiKeyOverride);
    const parsed = safeParse(raw);

    if (!parsed || !parsed.subject || !parsed.body) {
      throw new Error("Gemini returned invalid or missing subject/body fields.");
    }

    res.json(parsed);
  } catch (err) {
    console.error("Error in regenerate route:", err);
    res.status(500).json({ error: err.message || "Email regeneration failed." });
  }
}
