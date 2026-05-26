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

EMAIL RULES & GOLDEN PRINCIPLES:
1. High-Signal Keywords Only: Don't say "I am an expert developer who writes clean code." Say "I build with Python and LangGraph." Let the specific tools you use do the talking.
2. Name the Project: Always name-drop a specific project from the candidate's profile (like AutoStream or GymFlow). It anchors your claims in reality and gives them something specific to ask about.
3. The "What's in it for them" Pivot: The transition from what you built to how it helps them is where most cold emails fail. Always make sure you guess a real problem they are trying to solve and offer your skills as the solution.
4. Keep it under 120 words.
5. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
6. No begging tone, no long paragraphs, no resume-style listing.

WORD COUNT & ZONE BREAKDOWN (STRICTLY TARGET 75 TO 125 WORDS TOTAL):
- The sweet spot for a cold email to a startup founder or engineering lead is between 75 and 125 words. Too long (>150 words) looks like a wall of text. Too short (<50 words) looks lazy/templated.
- Adhere to this approximate breakdown by Zone:
  * [The Context]: 10 – 15 words. Short, genuine nod to their product (no corporate fluff) to validate that you actually know who they are.
  * [The Flex]: 30 – 45 words. State exactly what you do, naming 1-2 high-signal tools (e.g., LangGraph, Supabase, Streamlit) and a concrete project you actually built.
  * [The Connection]: 20 – 30 words. Show you understand their business by calling out a specific technical challenge/pain point they likely face (e.g., data pipeline scaling, UX constraints, automation bottlenecks).
  * [The Low-Friction Call to Action]: 10 – 15 words. Low-friction request for a quick chat + clear next steps (Portfolio/GitHub link).

EMAIL STRUCTURE (MANDATORY):
Subject: [Hook / Direct value proposition relevant to them]

Hey [Name],

[The Context]: Short, genuine nod to their product (no corporate fluff).

[The Flex]: 1-2 sentences stating exactly what you do, naming 1-2 high-signal tools (e.g., LangGraph, Supabase, Streamlit) and a concrete project you actually built. 

[The Connection]: Show you understand their business by naming a specific technical challenge they likely face (e.g., data pipeline scaling, UX constraints, automation bottlenecks).

[The Low-Friction Call to Action]: Specific, short time commitment + clear next steps (Portfolio/GitHub link).

Best,
[Your Name]

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
