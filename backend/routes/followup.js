import { callGemini } from "../services/gemini.js";
import { safeParse } from "../services/parser.js";

/**
 * Builds the Follow-up Email Prompt
 */
function buildFollowupPrompt(hrName, company, role, userProfile, previousSubject, previousBody) {
  return `
You are generating a short, professional follow-up email for job outreach.

INPUT:
Name: ${hrName}
Company: ${company}
Role: ${role}
User Background: ${userProfile}
Previous Subject Line: ${previousSubject || 'Re: Opportunity'}
Previous Email Body:
"""
${previousBody || ''}
"""

STRICT RULES:
- Polite but confident tone
- Reference the previous email (e.g. "Following up on my message last week about...")
- Keep it extremely short (under 60 words)
- Focus on how the candidate can add value to ${company}
- Output ONLY valid JSON
- No markdown formatting (no \`\`\`json)
- No extra explanation text

STRICT OUTPUT FORMAT:
{
  "subject": "string",
  "body": "string"
}
`;
}

/**
 * Express Route Handler: POST /api/followup
 */
export default async function handler(req, res) {
  try {
    const { hrName, company, role, userProfile, previousSubject, previousBody, geminiKeyOverride } = req.body;

    if (!hrName || !company || !role || !userProfile) {
      return res.status(400).json({ error: "Missing required parameters (hrName, company, role, userProfile)." });
    }

    const promptText = buildFollowupPrompt(hrName, company, role, userProfile, previousSubject, previousBody);
    const raw = await callGemini(promptText, geminiKeyOverride);
    const parsed = safeParse(raw);

    if (!parsed || !parsed.subject || !parsed.body) {
      throw new Error("Invalid follow-up email structured JSON from AI.");
    }

    res.json(parsed);
  } catch (err) {
    console.error("Error in followup route:", err);
    res.status(500).json({ error: err.message || "Follow-up generation failed." });
  }
}
