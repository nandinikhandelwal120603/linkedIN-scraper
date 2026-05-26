import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

export async function getProfile() {
  const SINGLETON_ID = "00000000-0000-0000-0000-000000000000";
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", SINGLETON_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      name: data.name || '',
      degree: data.degree || '',
      college: data.college || '',
      cgpa: data.cgpa || '',
      skills: data.skills || '',
      targetRole: data.target_role || '',
      linkedin: data.linkedin || '',
      github: data.github || '',
      projects: data.projects || '',
      tone: data.tone || 'confident, builder, not desperate'
    };
  } catch (err) {
    console.error("Error fetching profile from Supabase:", err);
    return null;
  }
}
