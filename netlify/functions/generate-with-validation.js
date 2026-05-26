import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";
import { getProfile } from "./utils/supabase.js";

// Helper to classify job type
export async function classifyJob(role, companyName, reason) {
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
export async function generateInitialEmail(lead, role, activeProfile, selectedProfile, mode) {
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

STRICT RULES & GOLDEN PRINCIPLES:
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
7. Tone: ${activeProfile.tone || 'confident, builder, not desperate'} (concise, builder energy, slightly technical, no fluff).

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
export async function validateEmail(subject, body, company, role, mode) {
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
export async function regenerateEmail(previousSubject, previousBody, issues, suggestions, activeProfile, selectedProfile, mode) {
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

STRICT RULES & GOLDEN PRINCIPLES:
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
export async function scoreLead(company, role, hrTitle, emailScore, mode) {
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
- Startup / small team → 23 - 25 points
- Mid-size / growing companies → 20 - 22 points
- Big tech / corporate → 15 - 19 points

2. ROLE RELEVANCE & DOMAIN MATCH (0–25)
- Direct match → 23 - 25 points
- Partial match → 18 - 22 points
- Weak match → 10 - 17 points

3. DECISION MAKER PROXIMITY (0–25)
- Founder / Hiring Manager / Tech Recruiter / Talent Acquisition → 23 - 25 points
- Engineer / Team Lead / General Recruiter → 18 - 22 points
- Generic HR / other roles → 12 - 17 points

4. EMAIL QUALITY SCORE (0–25)
- Use given email_score (normalize the score from 0-100 down to 0-25)

---

BEHAVIOR RULES:
- Be optimistic and encouraging. If a lead has a valid email, matches the role, and is actively hiring, give a higher lead score (aim for 75-95 overall).
- Do not artificially penalize valid recruiter/HR contacts or mid/large companies just because they are not tiny startups. Tech recruiters and mid/large companies are highly valuable targets.

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
export async function processContact(hr, companyName, role, activeProfile) {
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
    let recruiterSignalsText = "No real-time recruiter search context available.";

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

        // Extract company names and domains from topJobs to run real-time recruiter searches
        const uniqueCompanies = [];
        const seenCompanies = new Set();
        
        topJobs.forEach(job => {
          let companyName = job.snippet.split(" - ")[0] || job.title.split(" - ")[0] || "";
          companyName = companyName.trim();
          if (!companyName || seenCompanies.has(companyName.toLowerCase())) return;
          
          seenCompanies.add(companyName.toLowerCase());
          
          let domain = "";
          try {
            const parsedUrl = new URL(job.link);
            domain = parsedUrl.hostname.replace("www.", "");
            const jobBoards = ["indeed.", "linkedin.", "glassdoor.", "builtin.", "google.", "ziprecruiter.", "monster.", "simplyhired.", "naukri.", "wellfound.", "angel.co", "careerbuilder."];
            const isJobBoard = jobBoards.some(board => domain.includes(board));
            if (isJobBoard) {
              domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
            }
          } catch (e) {
            domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
          }
          
          uniqueCompanies.push({ companyName, domain });
        });

        if (uniqueCompanies.length > 0) {
          console.log(`🔍 Running Serper searches for actual recruiters and emails at companies: ${uniqueCompanies.map(c => `${c.companyName} (${c.domain})`).join(", ")}`);
          const recruiterSearchPromises = uniqueCompanies.map(async ({ companyName, domain }) => {
            const q1 = `"${companyName}" (recruiter OR "talent acquisition" OR "hiring manager") LinkedIn`;
            const q2 = `"${companyName}" (recruiter OR "talent acquisition" OR "hiring manager") "@${domain}"`;
            
            try {
              const [res1, res2] = await Promise.all([
                fetch("https://google.serper.dev/search", {
                  method: "POST",
                  headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ q: q1, num: 3 })
                }).then(r => r.ok ? r.json() : null),
                fetch("https://google.serper.dev/search", {
                  method: "POST",
                  headers: { "X-API-KEY": serperApiKey, "Content-Type": "application/json" },
                  body: JSON.stringify({ q: q2, num: 3 })
                }).then(r => r.ok ? r.json() : null)
              ]);
              
              const contacts = [];
              if (res1 && res1.organic) {
                res1.organic.forEach(item => {
                  contacts.push(`- LinkedIn Profile: ${item.title}\n  Profile Link: ${item.link}\n  Snippet: ${item.snippet}`);
                });
              }
              if (res2 && res2.organic) {
                res2.organic.forEach(item => {
                  contacts.push(`- Email/Contact info: ${item.title}\n  Link: ${item.link}\n  Snippet: ${item.snippet}`);
                });
              }
              
              return { 
                company: companyName, 
                domain, 
                contacts: contacts.join("\n") || "No real-time contact details found." 
              };
            } catch (err) {
              console.error(`Failed to fetch recruiter search for ${companyName}:`, err.message);
            }
            return { company: companyName, domain, contacts: "No recruiter search results found." };
          });

          const recruiterResults = await Promise.all(recruiterSearchPromises);
          recruiterSignalsText = recruiterResults.map(r => `
Company: ${r.company} (Domain: ${r.domain})
Recruiter Search Results:
${r.contacts}
`).join("\n---\n");
        }
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
Your task is to identify top hiring companies (top 8-10 ONLY) and find/generate recruiter contact entries.

${topJobs.length > 0 ? `
We have gathered the following REAL job signals from active listings:
${jobSignalsText}

We also searched the live web using Serper Dev to find real recruiter/Talent Acquisition LinkedIn profiles for these companies:
${recruiterSignalsText}

STRICT RULE:
Based on the real job signals and recruiter search results, extract the target company name, industry, and select the real recruiter contact and their LinkedIn URL from the search results. 
If the recruiter's email is not explicitly found in the search results, generate a realistic corporate email address based on their real name and the company's domain.
Follow these email generation guidelines:
- Prefer the format 'first.last@company.com' (e.g. sarah.jenkins@glassdoor.com) as it has the lowest bounce rate, or use 'first_initial+lastname@company.com' (e.g. sjenkins@glassdoor.com).
- Map the generated contacts directly to the companies from the signals and include the "job_link" matching that company.
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

    // 5. Sort descending by lead_score, Slice to top 8 (target 5-8 unique companies)
    const finalLeads = scoredLeads
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
