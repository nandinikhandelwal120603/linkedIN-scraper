import { callGemini } from "../services/gemini.js";
import { safeParse } from "../services/parser.js";

/**
 * Builds the Master Agent Prompt
 */
function buildPrompt(role, userProfile) {
  return `
You are an AI job outreach agent.

Your task:
1. Identify relevant companies based on the role
2. Generate realistic HR/hiring contacts
3. Create HIGHLY personalized cold emails per HR

STRICT RULES:
- Output ONLY valid JSON
- No markdown
- No explanation text
- No extra characters
- Ensure emails are professional and specific

INPUT:
Role: ${role}
User Background: ${userProfile}

OUTPUT FORMAT:
{
  "companies": [
    {
      "company_name": "string",
      "industry": "string",
      "reason_for_selection": "why this company fits the role",
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

EMAIL RULES:
- Must sound like a builder, not a job beggar
- Mention a project or skill
- Mention something about the company
- Keep under 120 words
- Avoid generic phrases like "I am very interested"

Make emails feel like:
→ "I built something relevant to you"
NOT
→ "Please give me job"

Generate 5–8 companies max.
Each company should have 2 HR contacts.

Now generate the output.
`;
}

/**
 * Express Route Handler: POST /api/generate
 */
export default async function handler(req, res) {
  try {
    const { role, userProfile, geminiKeyOverride } = req.body;

    if (!role) {
      return res.status(400).json({ error: "Role is required." });
    }
    if (!userProfile) {
      return res.status(400).json({ error: "User background profile is required." });
    }

    const promptText = buildPrompt(role, userProfile);
    const raw = await callGemini(promptText, geminiKeyOverride, '/api/generate');
    const parsed = safeParse(raw);

    // Validate structured response elements
    if (!parsed || !parsed.companies) {
      throw new Error("Gemini returned invalid or missing companies field.");
    }

    // Attach status and default tracking fields to HR contacts
    parsed.companies.forEach(c => {
      if (c.hr_contacts && Array.isArray(c.hr_contacts)) {
        c.hr_contacts.forEach(h => {
          h.status = "not_applied";
          h.notes = "";
          h.last_sent_at = null;
        });
      }
    });

    res.json(parsed);
  } catch (err) {
    console.error("Error in generate route:", err);
    res.status(500).json({ error: err.message || "Outreach generation failed." });
  }
}
