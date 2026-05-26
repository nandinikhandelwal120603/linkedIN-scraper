import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";
import { getProfile } from "./utils/supabase.js";

// Helper to run email validation
async function validateEmail(subject, body, company, role) {
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

---

EVALUATE STRICTLY:

1. HOOK QUALITY (0–25)
- Is the first line specific to THIS company/role?
- Or could it be sent to anyone?

2. PROOF STRENGTH (0–25)
- Is there ONE clear project/result with a metric?
- Or vague claims?

3. RELEVANCE (0–25)
- Does it align with the role/company?
- Or generic AI talk?

4. TONE (0–25)
- Confident, concise, not needy, not robotic?

---

AUTO-FAIL CONDITIONS:

If ANY of these are true:
- Generic opening line
- No specific project mentioned
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

  try {
    const raw = await callGemini(prompt);
    return safeParse(raw);
  } catch (err) {
    console.error("Validation error for company:", company, err);
    return {
      score: 50,
      verdict: "bad",
      issues: ["Validation failed to run: " + err.message],
      fix_suggestions: ["Try manual validation or regeneration"]
    };
  }
}

// Helper to regenerate email based on validation feedback
async function regenerateEmail(previousSubject, previousBody, issues, suggestions, activeProfile) {
  const prevEmailText = `Subject: ${previousSubject || ''}\n\n${previousBody || ''}`;
  const issuesText = (issues || []).join('\n');
  const suggestionsText = (suggestions || []).join('\n');

  const prompt = `
You are improving a cold outreach email.

---

PREVIOUS EMAIL:
${prevEmailText}

---

ISSUES IDENTIFIED:
${issuesText}

---

SUGGESTIONS:
${suggestionsText}

---

IMPROVEMENT GOAL:

Fix ALL issues while:
- keeping it natural
- keeping it short (max 120 words)
- keeping tone confident
- utilizing candidate profile context: ${JSON.stringify(activeProfile)}

---

STRICT RULES:
- Rewrite completely (not minor edits)
- Improve hook specificity
- Strengthen proof (project + metric)
- Remove generic phrases

---

OUTPUT JSON:
{
  "subject": "string",
  "body": "string"
}
`;

  try {
    const raw = await callGemini(prompt);
    return safeParse(raw);
  } catch (err) {
    console.error("Regeneration error:", err);
    return {
      subject: previousSubject,
      body: previousBody
    };
  }
}

// Process a single HR contact's email in a self-improving loop
async function processContact(hr, companyName, role, activeProfile) {
  const MAX_RETRIES = 2;
  let attempt = 0;

  let currentSubject = hr.email_content?.subject || 'Job Opportunity';
  let currentBody = hr.email_content?.body || '';

  let bestSubject = currentSubject;
  let bestBody = currentBody;
  let bestScore = 0;
  let bestValidation = null;

  while (attempt <= MAX_RETRIES) {
    const validation = await validateEmail(currentSubject, currentBody, companyName, role);
    const score = Number(validation.score) || 0;

    if (score > bestScore) {
      bestScore = score;
      bestSubject = currentSubject;
      bestBody = currentBody;
      bestValidation = validation;
    }

    if (score >= 80) {
      return {
        ...hr,
        email_content: {
          subject: currentSubject,
          body: currentBody
        },
        validation: {
          score,
          verdict: validation.verdict || "approved",
          issues: validation.issues || [],
          suggestions: validation.fix_suggestions || [],
          attempts: attempt + 1,
          status: "approved"
        }
      };
    }

    // Otherwise, regenerate using feedback
    const regenerated = await regenerateEmail(
      currentSubject,
      currentBody,
      validation.issues || [],
      validation.fix_suggestions || [],
      activeProfile
    );

    currentSubject = regenerated.subject || currentSubject;
    currentBody = regenerated.body || currentBody;

    attempt++;
  }

  // Fallback: return best version
  return {
    ...hr,
    email_content: {
      subject: bestSubject,
      body: bestBody
    },
    validation: {
      score: bestScore,
      verdict: bestValidation?.verdict || "fallback_best",
      issues: bestValidation?.issues || [],
      suggestions: bestValidation?.fix_suggestions || [],
      attempts: MAX_RETRIES + 1,
      status: "fallback_best"
    }
  };
}

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
    const { role, profile } = JSON.parse(event.body || '{}');

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    // 1. Generate companies and contacts
    const initialPrompt = `
You are an expert cold outreach strategist and recruiter research agent.
Your task is to identify top hiring companies (top 8-10 ONLY) matching the target role, generate realistic HR/recruiter contact entries, and craft high-converting cold outreach emails.

TARGET ROLE:
${role}

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}

STRICT RULES:
1. Keep the output companies list limited to top 8-10 ONLY.
2. For each company, provide 1 or 2 HR/recruiter contacts.
3. Every email body must be under 120 words.
4. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
5. No begging tone, no long paragraphs, no resume-style listing.
6. Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

EMAIL STRUCTURE (MANDATORY):
1. HOOK (first line MUST be specific): reference company / role / something real, showing you did homework.
2. PROOF (1-2 lines): mention ONE strong project or result from candidate's projects that matches company stack/needs. Make it sound real, not buzzwords.
3. VALUE (1 line): connect candidate's work to company's needs.
4. CLOSE (1 line): soft but confident ask (e.g. "Worth a quick chat?").

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

    const raw = await callGemini(initialPrompt);
    const parsed = safeParse(raw);

    if (!parsed.companies || !Array.isArray(parsed.companies)) {
      throw new Error("Invalid output from AI agent generator: missing companies array");
    }

    // 2. Validate and auto-improve each contact's email in parallel
    const processedCompanies = await Promise.all(parsed.companies.map(async (company) => {
      if (!company.hr_contacts || !Array.isArray(company.hr_contacts)) {
        return company;
      }

      const processedHR = await Promise.all(company.hr_contacts.map(async (hr) => {
        return await processContact(hr, company.company_name, role, activeProfile);
      }));

      return {
        ...company,
        hr_contacts: processedHR
      };
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ companies: processedCompanies })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
