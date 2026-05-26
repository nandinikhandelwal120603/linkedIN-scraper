import { supabase } from "./utils/supabase.js";

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
    const data = JSON.parse(event.body);

    // Insert into emails table
    const { data: emailData, error: emailError } = await supabase
      .from("emails")
      .insert([{
        company: data.company || 'Unknown',
        hr_name: data.hr_name || 'Unknown',
        hr_email: data.hr_email || '',
        subject: data.subject || '',
        body: data.body || '',
        status: data.status || 'sent'
      }])
      .select();

    if (emailError) throw emailError;

    const emailId = emailData?.[0]?.id;

    // Insert into events table
    const { error: eventError } = await supabase
      .from("events")
      .insert([{
        email_id: emailId,
        event_type: data.status || 'sent',
        company: data.company || 'Unknown',
        details: { notes: data.notes || '' }
      }]);

    if (eventError) throw eventError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, email_id: emailId })
    };

  } catch (err) {
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: err.message }) 
    };
  }
}

