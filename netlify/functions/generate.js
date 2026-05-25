import { callGemini } from "./utils/gemini.js";
import { safeParse } from "./utils/parser.js";

export async function handler(event) {
  // CORS support
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
    const { role, userProfile } = JSON.parse(event.body);

    const prompt = `
Generate companies + HR contacts + personalized cold emails.

Role: ${role}
Profile: ${userProfile}

Return strict JSON:
{
  "companies":[
    {
      "company_name":"",
      "hr_contacts":[
        {
          "name":"",
          "email":"",
          "email_confidence":"",
          "email_content":{
            "subject":"",
            "body":""
          }
        }
      ]
    }
  ]
}
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
