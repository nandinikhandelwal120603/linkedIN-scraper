import { supabase } from "./utils/supabase.js";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";

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
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", SINGLETON_ID)
        .maybeSingle();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, profile: data })
      };
    } else if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');

      const profileData = {
        id: SINGLETON_ID,
        name: payload.name || '',
        degree: payload.degree || '',
        college: payload.college || '',
        cgpa: payload.cgpa || '',
        skills: payload.skills || '',
        target_role: payload.targetRole || '',
        linkedin: payload.linkedin || '',
        github: payload.github || '',
        projects: payload.projects || '',
        tone: payload.tone || 'confident, builder, not desperate',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("user_profiles")
        .upsert([profileData])
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, profile: data })
      };
    } else {
      return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
