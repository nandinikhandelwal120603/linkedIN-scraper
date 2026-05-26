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

EMAIL RULES & GOLDEN PRINCIPLES:
1. High-Signal Keywords Only: Don't say "I am an expert developer who writes clean code." Say "I build with Python and LangGraph." Let the specific tools you use do the talking.
2. Name the Project: Always name-drop a specific project from the candidate's profile (like AutoStream or GymFlow). It anchors your claims in reality and gives them something specific to ask about.
3. The "What's in it for them" Pivot: The transition from what you built to how it helps them is where most cold emails fail. Always make sure you guess a real problem they are trying to solve and offer your skills as the solution.
4. Rewrite completely (not minor edits)
5. Improve hook specificity
6. Strengthen proof (project + metric)
7. Remove generic phrases

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

STRICT JSON OUTPUT:
{
  "subject": "string",
  "body": "string"
}
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
    const raw = await callGemini(promptText, geminiKeyOverride, '/api/regenerate');
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
