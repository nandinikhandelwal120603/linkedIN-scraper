import { google } from "googleapis";
import { supabase } from "./utils/supabase.js";

// Helper to decode base64url encoded parts of a Gmail message
function getBodyText(payload) {
  let body = "";
  if (payload.body && payload.body.data) {
    body += Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    payload.parts.forEach(part => {
      body += getBodyText(part);
    });
  }
  return body;
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
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Google API credentials or GMAIL_REFRESH_TOKEN are missing in backend configuration.");
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch the list of sent emails from Supabase that are not already marked failed/bounced
    const { data: sentEmails, error: dbError } = await supabase
      .from("emails")
      .select("id, hr_email, company, subject")
      .neq("status", "failed");

    if (dbError) throw dbError;

    if (!sentEmails || sentEmails.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: "No active emails to monitor for bounces.", processedBounces: [] })
      };
    }

    // Search Gmail for bounce notifications in the last 7 days
    const query = "from:mailer-daemon";
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50
    });

    const messages = response.data.messages || [];
    const processedBounces = [];

    for (const msg of messages) {
      const msgDetails = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full"
      });

      const bodyText = getBodyText(msgDetails.data.payload || {});
      const subject = (msgDetails.data.payload?.headers || []).find(h => h.name?.toLowerCase() === "subject")?.value || "";

      // Check if any of our sent emails are referenced in the bounce body or subject
      for (const email of sentEmails) {
        const emailMatch = bodyText.includes(email.hr_email) || subject.includes(email.hr_email);
        if (emailMatch) {
          // Verify if we already logged this bounce to prevent duplicate events
          const { data: existingEvents } = await supabase
            .from("events")
            .select("id")
            .eq("email_id", email.id)
            .eq("event_type", "failed");

          if (!existingEvents || existingEvents.length === 0) {
            // Update email status to failed in Supabase
            await supabase
              .from("emails")
              .update({ status: "failed" })
              .eq("id", email.id);

            // Log event timeline activity
            await supabase
              .from("events")
              .insert([{
                email_id: email.id,
                event_type: "failed",
                company: email.company,
                details: {
                  reason: "Address not found / Mailbox unavailable (Gmail Bounce back)",
                  message_id: msg.id,
                  subject: subject
                }
              }]);

            processedBounces.push({
              id: email.id,
              hr_email: email.hr_email,
              company: email.company
            });
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully processed messages. Found ${processedBounces.length} new bounces.`,
        processedBounces
      })
    };

  } catch (err) {
    console.error("Bounce check error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
