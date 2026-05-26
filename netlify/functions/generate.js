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
    const { role, profile } = JSON.parse(event.body);

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    const prompt = `
You are an expert cold outreach strategist and recruiter research agent.
Your task is to identify top hiring companies (top 8-10 ONLY) matching the target role, generate realistic HR/recruiter contact entries, and craft high-converting cold outreach emails.

TARGET ROLE:
${role}

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}

STRICT RULES:
1. Keep the output companies list limited to top 8-10 ONLY.
2. For each company, provide 1 or 2 HR/recruiter contacts.
3. STRICT RULES & GOLDEN PRINCIPLES:
   - Speak Developer-to-Developer: Write exactly how engineers talk to each other on Slack/Discord: concise, direct, focused on implementation over theory. Ask yourself: "Would I say this out loud to another engineer over a beer?" If it sounds too formal/stiff, rewrite it.
   - Respect Their Scale (Don't Lecture Them): Never explain a company's own tech stack or business model back to them. Empathize with the difficulty of their scale instead.
     * ❌ "Indeed relies on sub-millisecond query routing to handle massive job indexes."
     * ✓ "Managing search intent across millions of live job posts is a massive data challenge."
   - Talk About HOW You Build: High-signal engineers talk architecture and constraints. Use specific, production-focused keywords. Use terms like: deterministic workflows, high-throughput, evaluation harnesses, latency reduction, state management, edge cases. E.g. "Moving past basic prompt chains into deterministic LangGraph workflows."
   - Strip Out Passive, Formal Fluff: Avoid corporate phrases. E.g.
     * Replace "I recognize the challenge of..." with "Scaling [X] usually runs into..."
     * Replace "I would love to learn about your roadmap..." with "I'd love to see how you're handling..."
     * Replace "My experience could support your team..." with "Love to share how I solved this..."
     * Replace "Are you open to a 10-minute technical sync?" with "Open to a quick 10-minute chat?"
   - Use Grit Over Polish: Sound like a builder who just stepped away from their IDE. Use active, punchy verbs (slashed latency, cut bottlenecks, shipped) and casual punctuation (—, /) naturally.
   - Name the Project: Always name-drop a specific project from the candidate's profile (like AutoStream or GymFlow). It anchors your claims in reality.
   - Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).
   - No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
   - No begging tone, no long paragraphs, no resume-style listing.
4. WORD COUNT & ZONE BREAKDOWN (STRICTLY TARGET 75 TO 125 WORDS TOTAL):
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

OUTPUT FORMAT (STRICT JSON):
{
  "companies": [
    {
      "company_name": "string",
      "industry": "string",
      "reason_for_selection": "string",
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

Now generate the output.
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

