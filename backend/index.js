import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Route Handlers
import generateHandler from './routes/generate.js';
import regenerateHandler from './routes/regenerate.js';
import analyzeReplyHandler from './routes/analyze-reply.js';
import followupHandler from './routes/followup.js';

// Initialize configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE_PATH = path.join(__dirname, '../outreach_log.json');

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for easier local dev and testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Enpoints
app.post('/api/generate', generateHandler);
app.post('/api/regenerate', regenerateHandler);
app.post('/api/analyze-reply', analyzeReplyHandler);
app.post('/api/followup', followupHandler);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

// Backward compatibility: Log outreach attempts
app.post('/api/log-attempt', (req, res) => {
  try {
    const attempt = {
      id: req.body.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      company: req.body.company || 'Unknown',
      hr_name: req.body.hr_name || 'Unknown',
      hr_email: req.body.hr_email || '',
      subject: req.body.subject || '',
      status: req.body.status || 'sent',
      notes: req.body.notes || ''
    };
    
    let logs = [];
    if (fs.existsSync(LOG_FILE_PATH)) {
      const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
      try { logs = JSON.parse(content); } catch { logs = []; }
    }
    
    logs.unshift(attempt);
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
    res.json({ success: true, data: attempt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backward compatibility: Retrieve logged history
app.get('/api/history', (req, res) => {
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE_PATH)) {
      const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
      try { logs = JSON.parse(content); } catch { logs = []; }
    }
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static assets if available (for production build)
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendBuildPath));

// Fallback to frontend index.html for SPA routing in production
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>AI Outreach Agent Server</title></head>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #121214; color: #e1e1e6; margin: 0;">
          <h1>🤖 AI Outreach Agent Server is Running</h1>
          <p>API Endpoint: <code style="background-color: #202024; padding: 4px 8px; border-radius: 4px;">/api</code></p>
          <p style="color: #8d8d99; font-size: 14px;">Frontend static files not built yet. Run <code>npm run build</code> in the workspace root to serve it from here.</p>
        </body>
        </html>
      `);
    }
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==================================================`);
});
