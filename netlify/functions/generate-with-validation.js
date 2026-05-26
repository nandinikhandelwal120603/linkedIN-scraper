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

// Helper to run lead scoring evaluation
async function scoreLead(company, role, hrTitle, emailScore) {
  const prompt = `
You are evaluating whether a job outreach lead is worth emailing.

Your goal:
Prioritize leads with the highest chance of reply.

---

LEAD INFO:

Company: ${company}
Role: ${role}
HR Title: ${hrTitle}
Email Score: ${emailScore}

---

EVALUATE:

1. COMPANY TYPE (0–25)
- Startup / small team → high
- Mid-size → medium
- Big tech / corporate → low

2. ROLE RELEVANCE (0–25)
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

  try {
    const raw = await callGemini(prompt);
    return safeParse(raw);
  } catch (err) {
    console.error("Lead scoring error:", err);
    return {
      lead_score: 70,
      priority: "medium",
      reason: "Could not evaluate lead score due to API error: " + err.message
    };
  }
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
2. Return maximum ONE contact per company. Do NOT include multiple employees from the same company. Prefer diversity of companies over multiple contacts.
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

    // Flatten contacts list to process validation in parallel
    const initialLeads = [];
    parsed.companies.forEach(company => {
      if (company.hr_contacts && Array.isArray(company.hr_contacts)) {
        company.hr_contacts.forEach(hr => {
          initialLeads.push({
            company_name: company.company_name,
            industry: company.industry || 'Tech',
            reason_for_selection: company.reason_for_selection || '',
            hr_name: hr.name,
            hr_email: hr.email,
            hr_email_confidence: hr.email_confidence || 'medium',
            hr_linkedin: hr.linkedin || '',
            hr_title: hr.title || 'Recruiter',
            email_content: hr.email_content || { subject: '', body: '' }
          });
        });
      }
    });

    // 2. Validate and auto-improve each contact's email in parallel
    const validatedLeads = await Promise.all(initialLeads.map(async (lead) => {
      const MAX_RETRIES = 2;
      let attempt = 0;

      let currentSubject = lead.email_content.subject || 'Job Opportunity';
      let currentBody = lead.email_content.body || '';

      let bestSubject = currentSubject;
      let bestBody = currentBody;
      let bestScore = 0;
      let bestValidation = null;

      while (attempt <= MAX_RETRIES) {
        const validation = await validateEmail(currentSubject, currentBody, lead.company_name, role);
        const score = Number(validation.score) || 0;

        if (score > bestScore) {
          bestScore = score;
          bestSubject = currentSubject;
          bestBody = currentBody;
          bestValidation = validation;
        }

        if (score >= 80) {
          return {
            ...lead,
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

      return {
        ...lead,
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
    }));

    // 3. Deduplication: Pick the BEST contact per company (highest validation score)
    const companyMap = new Map();
    for (const lead of validatedLeads) {
      const key = lead.company_name.toLowerCase().trim();
      if (!companyMap.has(key)) {
        companyMap.set(key, lead);
      } else {
        const existing = companyMap.get(key);
        const currentScore = lead.validation?.score || 0;
        const existingScore = existing.validation?.score || 0;
        if (currentScore > existingScore) {
          companyMap.set(key, lead);
        }
      }
    }
    const uniqueLeads = Array.from(companyMap.values());

    // 4. Score each unique lead using the Lead Scoring Agent (in parallel)
    const scoredLeads = await Promise.all(uniqueLeads.map(async (lead) => {
      const scoreResult = await scoreLead(
        lead.company_name,
        role,
        lead.hr_title,
        lead.validation?.score || 80
      );

      return {
        ...lead,
        lead_score: scoreResult.lead_score || 70,
        lead_priority: scoreResult.priority || 'medium',
        lead_reason: scoreResult.reason || 'Standard lead match'
      };
    }));

    // 5. Filter: keep only leads with lead_score >= 70, Sort descending by lead_score, Slice to top 8 (target 5-8 unique companies)
    const finalLeads = scoredLeads
      .filter(l => l.lead_score >= 70)
      .sort((a, b) => b.lead_score - a.lead_score)
      .slice(0, 8);

    // 6. Format back to company-oriented structure for the frontend
    const finalCompanies = finalLeads.map(lead => ({
      company_name: lead.company_name,
      industry: lead.industry,
      reason_for_selection: lead.reason_for_selection,
      hr_contacts: [
        {
          name: lead.hr_name,
          email: lead.hr_email,
          email_confidence: lead.hr_email_confidence,
          linkedin: lead.hr_linkedin,
          email_content: lead.email_content,
          validation: lead.validation,
          lead_score: lead.lead_score,
          lead_priority: lead.lead_priority,
          lead_reason: lead.lead_reason
        }
      ]
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ companies: finalCompanies })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
