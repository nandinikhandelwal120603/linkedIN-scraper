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
1. Speak Developer-to-Developer: Write exactly how engineers talk to each other on Slack/Discord: concise, direct, focused on implementation over theory. Ask yourself: "Would I say this out loud to another engineer over a beer?" If it sounds too formal/stiff, rewrite it.
2. Respect Their Scale (Don't Lecture Them): Never explain a company's own tech stack or business model back to them. Empathize with the difficulty of their scale instead.
   - ❌ "Indeed relies on sub-millisecond query routing to handle massive job indexes."
   - ✓ "Managing search intent across millions of live job posts is a massive data challenge."
3. Talk About HOW You Build: High-signal engineers talk architecture and constraints. Use specific, production-focused keywords. Use terms like: deterministic workflows, high-throughput, evaluation harnesses, latency reduction, state management, edge cases. E.g. "Moving past basic prompt chains into deterministic LangGraph workflows."
4. Strip Out Passive, Formal Fluff: Avoid corporate phrases. E.g.
   - Replace "I recognize the challenge of..." with "Scaling [X] usually runs into..."
   - Replace "I would love to learn about your roadmap..." with "I'd love to see how you're handling..."
   - Replace "My experience could support your team..." with "Love to share how I solved this..."
   - Replace "Are you open to a 10-minute technical sync?" with "Open to a quick 10-minute chat?"
5. Use Grit Over Polish: Sound like a builder who just stepped away from their IDE. Use active, punchy verbs (slashed latency, cut bottlenecks, shipped) and casual punctuation (—, /) naturally.
6. Name the Project: Always name-drop a specific project from the candidate's profile (like AutoStream or GymFlow). It anchors your claims in reality.
7. Rewrite completely (not minor edits)
8. Improve hook specificity
9. Strengthen proof (project + metric)
10. Remove generic phrases

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

[The Low-Friction Call to Action]: Specific, short time commitment + clear next steps. Link to portfolio and GitHub.

Best,
[Your Name]
[nandinikhandewal.netlify.app](https://nandinikhandewal.netlify.app/) | [GitHub](https://github.com/nandinikhandelwal120603)

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
