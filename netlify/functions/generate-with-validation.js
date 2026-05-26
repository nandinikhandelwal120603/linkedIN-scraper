import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";
import { getProfile } from "./utils/supabase.js";

// Helper to classify job type
async function classifyJob(role, companyName, reason) {
  const prompt = `
Classify this job opportunity into one of these exact categories:
[genai, aiml, cv, robotics, automation]

Role: ${role}
Company: ${companyName}
Context: ${reason}

Return ONLY one word from the list.
`;

  try {
    const raw = await callGemini(prompt);
    const mode = raw.trim().toLowerCase();
    const validModes = ["genai", "aiml", "cv", "robotics", "automation"];
    return validModes.includes(mode) ? mode : "genai";
  } catch (err) {
    console.error("Job classification error:", err);
    return "genai";
  }
}

// Helper to generate initial email tailored to a profile mode
async function generateInitialEmail(lead, role, activeProfile, selectedProfile, mode) {
  const prompt = `
You are writing a cold outreach email.

---

CANDIDATE PROFILE:

Name: ${activeProfile.name || ''}
Degree: ${activeProfile.degree || ''}
College: ${activeProfile.college || ''}
CGPA: ${activeProfile.cgpa || ''}
LinkedIn: ${activeProfile.linkedin || ''}
GitHub: ${activeProfile.github || ''}

Mode: ${mode}

Summary:
${selectedProfile.summary || ''}

Skills:
${(selectedProfile.skills || []).join(", ")}

Key Projects:
${(selectedProfile.key_projects || []).map(p => `
- ${p.title}: ${p.description} (${p.impact || ''})
`).join("\n")}

Signals:
${(selectedProfile.signals || []).join(", ")}

---

TARGET:
Company: ${lead.company_name}
Role: ${role}
Context: ${lead.reason_for_selection}

---

STRICT RULES:
1. Keep the email body under 120 words.
2. No generic phrases ("I hope you're doing well", "I came across your company", "I am very interested").
3. No begging tone, no long paragraphs, no resume-style listing.
4. Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

EMAIL STRUCTURE (MANDATORY):
1. HOOK (first line MUST be specific): reference company / role / something real, showing you did homework.
2. PROOF (1-2 lines): mention ONE relevant project from the candidate's projects above.
3. VALUE (1 line): connect candidate's work to company's needs.
4. CLOSE (1 line): soft but confident ask (e.g. "Worth a quick chat?").

OUTPUT FORMAT (STRICT JSON):
{
  "subject": "string",
  "body": "string"
}
`;

  try {
    const raw = await callGemini(prompt);
    return safeParse(raw);
  } catch (err) {
    console.error("Initial email generation error:", err);
    return {
      subject: `Outreach regarding ${role} role at ${lead.company_name}`,
      body: `Hi, I am interested in the ${role} position.`
    };
  }
}

// Helper to run email validation
async function validateEmail(subject, body, company, role, mode) {
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
Role Domain (Mode): ${mode}

---

EVALUATE STRICTLY:

1. HOOK QUALITY (0–25)
- Is the first line specific to THIS company/role?
- Or could it be sent to anyone?

2. PROOF STRENGTH (0–25)
- Is there ONE clear relevant project/result?
- IMPORTANT: Does the project proof match the job domain (${mode})? Or is there a mismatch (e.g. emailing a GenAI role but proving with a CV project)? Reject mismatch with low score.

3. RELEVANCE (0–25)
- Does it align with the role/company and domain (${mode})?
- Or generic AI talk?

4. TONE (0–25)
- Confident, concise, not needy, not robotic?

---

AUTO-FAIL CONDITIONS:

If ANY of these are true:
- Generic opening line
- No specific relevant project mentioned
- Project proof does not match the role domain (${mode})
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
async function regenerateEmail(previousSubject, previousBody, issues, suggestions, activeProfile, selectedProfile, mode) {
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
- utilizing candidate profile context for Mode (${mode}):
  Summary: ${selectedProfile.summary || ''}
  Skills: ${(selectedProfile.skills || []).join(", ")}
  Projects: ${(selectedProfile.key_projects || []).map(p => `- ${p.title}: ${p.description}`).join("\n")}

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
async function scoreLead(company, role, hrTitle, emailScore, mode) {
  const prompt = `
You are evaluating whether a job outreach lead is worth emailing.

Your goal:
Prioritize leads with the highest chance of reply.

---

LEAD INFO:

Company: ${company}
Role: ${role}
Role Domain (Mode): ${mode}
HR Title: ${hrTitle}
Email Score: ${emailScore}

---

EVALUATE:

1. COMPANY TYPE (0–25)
- Startup / small team → high
- Mid-size → medium
- Big tech / corporate → low

2. ROLE RELEVANCE & DOMAIN MATCH (0–25)
- Does candidate profile strongly match this role domain (${mode})?
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

// Process a single HR contact's email in a self-improving loop
async function processContact(hr, companyName, role, activeProfile) {
  const MAX_RETRIES = 2;
  let attempt = 0;

  // 1. Classify job type into one of the modes
  const mode = await classifyJob(role, companyName, hr.reason_for_selection || '');
  const profileModes = activeProfile.profileModes || {};
  const selectedProfile = profileModes[mode] || profileModes["genai"] || {};

  // 2. Generate initial email draft tailored to the selected mode
  const initialEmail = await generateInitialEmail(hr, role, activeProfile, selectedProfile, mode);

  let currentSubject = initialEmail.subject || 'Job Opportunity';
  let currentBody = initialEmail.body || '';

  let bestSubject = currentSubject;
  let bestBody = currentBody;
  let bestScore = 0;
  let bestValidation = null;

  while (attempt <= MAX_RETRIES) {
    const validation = await validateEmail(currentSubject, currentBody, companyName, role, mode);
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
        mode,
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
      activeProfile,
      selectedProfile,
      mode
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
    mode,
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
    const { role, profile, serperKeyOverride } = JSON.parse(event.body || '{}');

    const dbProfile = await getProfile();
    const activeProfile = dbProfile || profile || {};

    const serperApiKey = serperKeyOverride || process.env.SERPER_API_KEY;
    let topJobs = [];

    if (serperApiKey) {
      console.log(`🔍 Running dual-pipeline Serper search for role: ${role}`);
      const queries = [
        `${role} fresher OR 0-1 years hiring India`,
        `remote ${role} junior OR entry level hiring`,
        `"we are hiring ${role}"`,
        `"looking for ${role} developer"`,
        `${role} internship OR fresher startup hiring`
      ];

      try {
        const searchPromises = queries.map(async (q) => {
          try {
            const response = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: {
                "X-API-KEY": serperApiKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ q, num: 8 })
            });

            if (!response.ok) {
              console.error(`Serper query error for "${q}": ${response.statusText}`);
              return [];
            }

            const data = await response.json();
            return (data.organic || []).map(item => ({
              title: item.title || "",
              link: item.link || "",
              snippet: item.snippet || "",
              source_query: q
            }));
          } catch (err) {
            console.error(`Serper query network error for "${q}":`, err.message);
            return [];
          }
        });

        const results = await Promise.all(searchPromises);
        const allJobs = results.flat();

        // 1. Tagging (Remote vs India)
        const tagged = allJobs.map(job => {
          const isRemote = job.source_query.toLowerCase().includes("remote") || 
                           job.title.toLowerCase().includes("remote") || 
                           job.snippet.toLowerCase().includes("remote");
          return {
            ...job,
            type: isRemote ? "remote" : "india"
          };
        });

        // 2. Filtering for junior/entry/fresher intent
        const filtered = tagged.filter(job => {
          const text = (job.title + " " + job.snippet).toLowerCase();
          return (
            text.includes("fresher") ||
            text.includes("0-1") ||
            text.includes("intern") ||
            text.includes("junior") ||
            text.includes("entry") ||
            text.includes("hiring")
          );
        });

        // 3. Priority Scoring
        const scoredJobs = filtered.map(job => {
          let score = 0;
          const combined = (job.title + " " + job.snippet).toLowerCase();
          if (job.type === "remote") score += 10;
          if (combined.includes("ai")) score += 10;
          if (combined.includes("llm")) score += 15;
          if (combined.includes("startup")) score += 10;
          return { ...job, score };
        });

        scoredJobs.sort((a, b) => b.score - a.score);
        topJobs = scoredJobs.slice(0, 8);
        console.log(`✅ Serper search complete. Found ${scoredJobs.length} matching jobs, selected top ${topJobs.length}.`);
      } catch (err) {
        console.error("❌ Serper pipeline failed, falling back to generative mode:", err.message);
      }
    } else {
      console.log("⚠️ No Serper API Key found, proceeding with generative-only mode.");
    }

    let jobSignalsText = "";
    if (topJobs.length > 0) {
      jobSignalsText = topJobs.map((j, idx) => `
Job #${idx + 1}:
Title: ${j.title}
Link: ${j.link}
Snippet: ${j.snippet}
Type: ${j.type} (Score: ${j.score})
`).join("\n");
    }

    // 1. Generate companies and contacts
    const initialPrompt = `
You are an expert cold outreach strategist and recruiter research agent.
Your task is to identify top hiring companies (top 8-10 ONLY) and generate realistic HR/recruiter contact entries.

${topJobs.length > 0 ? `
We have gathered the following REAL job signals from active listings:
${jobSignalsText}

STRICT RULE:
Based on the real job signals above, extract the target company name, industry, and select or guess a realistic HR/recruiter contact (e.g. Talent Acquisition, HR Manager, Founder). Map the generated contacts directly to the companies from the signals and include the "job_link" matching that company.
` : `
TARGET ROLE:
${role}

CANDIDATE PROFILE:
${JSON.stringify(activeProfile)}
`}

STRICT RULES:
1. Keep the output companies list limited to top 8-10 ONLY.
2. Return maximum ONE contact per company. Do NOT include multiple employees from the same company. Prefer diversity of companies over multiple contacts.

OUTPUT FORMAT (STRICT JSON):
{
  "companies": [
    {
      "company_name": "string",
      "industry": "string",
      "reason_for_selection": "string",
      "job_link": "string",
      "hr_contacts": [
        {
          "name": "string",
          "email": "string",
          "email_confidence": "high | medium | low",
          "linkedin": "string"
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
            job_link: company.job_link || '',
            hr_name: hr.name,
            hr_email: hr.email,
            hr_email_confidence: hr.email_confidence || 'medium',
            hr_linkedin: hr.linkedin || '',
            hr_title: hr.title || 'Recruiter'
          });
        });
      }
    });

    // 2. Validate and auto-improve each contact's email in parallel
    const validatedLeads = await Promise.all(initialLeads.map(async (lead) => {
      return await processContact(lead, lead.company_name, role, activeProfile);
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
        lead.validation?.score || 80,
        lead.mode || 'genai'
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
      job_link: lead.job_link || '',
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
          lead_reason: lead.lead_reason,
          mode: lead.mode
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
