import { google } from "googleapis";

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html'
  };

  try {
    const code = event.queryStringParameters?.code;
    if (!code) {
      throw new Error("Authorization code is missing in callback.");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID?.trim(),
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
      process.env.GOOGLE_REDIRECT_URI?.trim()
    );

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      // Sometimes Google only returns the refresh token on the first authorization.
      // Render a warning if they need to disconnect and re-consent.
      return {
        statusCode: 200,
        headers,
        body: renderHtmlPage({
          success: false,
          title: "Consent Missing Refresh Token",
          content: `
            <p style="margin-bottom:1rem;">Google did not return a <strong>refresh_token</strong>. This happens if you have already authorized this app previously.</p>
            <p style="margin-bottom:1.5rem;color:#e11d48;"><strong>Fix:</strong> Go to your Google Account permissions, remove access for this App, and click "Connect Gmail" again.</p>
            <a href="${process.env.GOOGLE_REDIRECT_URI?.replace('/.netlify/functions/auth-callback', '') || '#'}" style="display:inline-block;padding:0.75rem 1.5rem;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:600;transition:all 0.2s;">Return to Workspace</a>
          `
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: renderHtmlPage({
        success: true,
        title: "Gmail Authenticated Successfully!",
        content: `
          <p style="margin-bottom:1.25rem;color:#94a3b8;font-size:0.95rem;">Copy this refresh token and save it inside your Netlify env settings as <code>GMAIL_REFRESH_TOKEN</code>:</p>
          <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:1rem;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <code style="color:#38bdf8;font-family:'JetBrains Mono',monospace;word-break:break-all;font-size:0.9rem;" id="tokenText">${refreshToken}</code>
            <button onclick="copyToken()" style="background:#1e293b;border:1px solid #475569;color:#e2e8f0;padding:0.5rem 1rem;border-radius:6px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all 0.15s;" id="copyBtn">Copy Token</button>
          </div>
          <p style="margin-bottom:1.5rem;font-size:0.85rem;color:#64748b;">⚠️ Keep this token private. It allows your serverless agent to dispatch emails securely.</p>
          <script>
            function copyToken() {
              const text = document.getElementById('tokenText').innerText;
              navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.innerText = 'Copied!';
                btn.style.background = '#059669';
                btn.style.borderColor = '#10b981';
                setTimeout(() => {
                  btn.innerText = 'Copy Token';
                  btn.style.background = '#1e293b';
                  btn.style.borderColor = '#475569';
                }, 2000);
              });
            }
          </script>
        `
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: renderHtmlPage({
        success: false,
        title: "OAuth Callback Error",
        content: `<p style="color:#e11d48;margin-bottom:1rem;">${err.message}</p>`
      })
    };
  }
}

function renderHtmlPage({ success, title, content }) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Outfit', sans-serif;
          background: radial-gradient(circle at top, #1e1b4b 0%, #090514 100%);
          color: #f8fafc;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
        .card {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.5rem;
          max-width: 550px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          text-align: center;
        }
        .icon {
          font-size: 3rem;
          margin-bottom: 1.5rem;
        }
        h1 {
          font-size: 1.6rem;
          margin-bottom: 1rem;
          color: ${success ? '#10b981' : '#f43f5e'};
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${success ? '🎉' : '⚠️'}</div>
        <h1>${title}</h1>
        ${content}
      </div>
    </body>
    </html>
  `;
}
