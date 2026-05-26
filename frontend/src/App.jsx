import React, { useState, useEffect } from 'react';

const API_BASE_URL = '/.netlify/functions';

export default function App() {
  // --- STATE ---
  // API Keys (Persistent)
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('outreach_gemini_key') || '');
  const [serperKey, setSerperKey] = useState(() => localStorage.getItem('outreach_serper_key') || '');
  const [useGmailApi, setUseGmailApi] = useState(() => localStorage.getItem('outreach_use_gmail_api') === 'true');
  
  // User Profile (Persistent & Synced with Supabase)
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('outreach_user_profile');
    return saved ? JSON.parse(saved) : {
      name: '',
      degree: '',
      college: '',
      cgpa: '',
      skills: '',
      targetRole: '',
      linkedin: '',
      github: '',
      projects: '',
      tone: 'confident, builder, not desperate'
    };
  });

  // UI Settings / Toggles
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(true);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'tracker' | 'history'
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [viewMode, setViewMode] = useState('slide'); // 'slide' | 'list'
  
  // Job Search Inputs
  const [searchRole, setSearchRole] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  
  // Agent Execution States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  
  // Single Source of Truth for HR Contacts & Emails (Persistent)
  const [contacts, setContacts] = useState(() => {
    const saved = localStorage.getItem('outreach_contacts');
    return saved ? JSON.parse(saved) : [];
  });

  // Outreach History Log from Backend
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Send Guardrails States
  const [autoSend, setAutoSend] = useState(() => localStorage.getItem('outreach_auto_send') === 'true');
  const [dailyLimit] = useState(25);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [isDelayActive, setIsDelayActive] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSendContactId, setPendingSendContactId] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    localStorage.setItem('outreach_gemini_key', geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    localStorage.setItem('outreach_serper_key', serperKey);
  }, [serperKey]);

  useEffect(() => {
    localStorage.setItem('outreach_use_gmail_api', useGmailApi ? 'true' : 'false');
  }, [useGmailApi]);

  useEffect(() => {
    localStorage.setItem('outreach_user_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('outreach_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('outreach_auto_send', autoSend ? 'true' : 'false');
  }, [autoSend]);

  // Load profile and history logs on startup
  useEffect(() => {
    fetchProfile();
    fetchHistory();
  }, []);

  // Reload history when tab is clicked
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  // Keyboard navigation for Slide View
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'tracker' || viewMode !== 'slide' || contacts.length === 0) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        setActiveCardIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveCardIndex(prev => Math.min(contacts.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, viewMode, contacts.length]);

  // --- ACTIONS ---
  
  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile({
          name: data.profile.name || '',
          degree: data.profile.degree || '',
          college: data.profile.college || '',
          cgpa: data.profile.cgpa || '',
          skills: data.profile.skills || '',
          targetRole: data.profile.target_role || '',
          linkedin: data.profile.linkedin || '',
          github: data.profile.github || '',
          projects: data.profile.projects || '',
          tone: data.profile.tone || 'confident, builder, not desperate'
        });
      }
    } catch (err) {
      console.error("Failed to load profile from Supabase:", err);
    }
  };

  const saveProfileToDb = async (e) => {
    if (e) e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      if (data.success) {
        alert("Profile saved to Supabase successfully!");
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      alert("Failed to save profile: " + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleConnectGmail = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to get Google authorization URL: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Error connecting to auth function: " + err.message);
    }
  };

  const saveSettings = (e) => {
    e.preventDefault();
    setShowSettings(false);
  };

  // Fetch logged outreach events from backend
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/history`);
      const result = await res.json();
      if (result.success && result.data) {
        setHistoryLogs(result.data);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };
  // Main Agent Trigger: Discover & Generate Emails
  const handleStartDiscovery = async (e) => {
    e.preventDefault();
    if (!searchRole) return;
    
    setIsLoading(true);
    setError(null);
    setLoadingStep('Searching the web for active listings...');
    
    // Quick delay simulation for premium feel steps
    const timer1 = setTimeout(() => setLoadingStep('Analyzing relevant companies...'), 3500);
    const timer2 = setTimeout(() => setLoadingStep('Extracting HR recruiter contacts...'), 7000);
    const timer3 = setTimeout(() => setLoadingStep('Crafting personalized cold emails...'), 11000);

    try {
      const response = await fetch(`${API_BASE_URL}/generate-with-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: searchRole,
          profile: profile,
          geminiKeyOverride: geminiKey,
          serperKeyOverride: serperKey
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Server returned an error');
      }

      if (!result.companies || result.companies.length === 0) {
        throw new Error('AI could not find any companies. Try adjusting the role or verify your credentials.');
      }

      // Flatten nested companies/hr_contacts structure into single source of truth list
      const flattenedContacts = [];
      result.companies.forEach(company => {
        if (company.hr_contacts && Array.isArray(company.hr_contacts)) {
          company.hr_contacts.forEach(hr => {
            const companyClean = (company.company_name || 'Unknown').replace(/\s+/g, '-').toLowerCase();
            const hrClean = (hr.name || 'recruiter').replace(/\s+/g, '-').toLowerCase();
            const id = `${companyClean}-${hrClean}-${Math.floor(Math.random() * 1000)}`;
            
            const subject = hr.email_content?.subject || 'Re: Job Opportunity';
            const body = hr.email_content?.body || '';
            const email = hr.email || '';

            const encodedTo = encodeURIComponent(email);
            const encodedSubject = encodeURIComponent(subject);
            const encodedBody = encodeURIComponent(body);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;

            flattenedContacts.push({
              id,
              company: company.company_name,
              industry: company.industry || 'Tech',
              reason_for_selection: company.reason_for_selection || '',
              careers_url: company.job_link || '',
              hr_name: hr.name,
              hr_email: email,
              hr_email_confidence: hr.email_confidence || 'medium',
              hr_title: 'Hiring Recruiter',
              hr_linkedin: hr.linkedin || '',
              subject,
              body,
              status: hr.status || 'not_applied',
              notes: '',
              last_sent_at: null,
              gmail_compose_url: gmailUrl,
              isRegenerating: false,
              score: hr.validation?.score || 80,
              verdict: hr.validation?.verdict || 'good',
              issues: hr.validation?.issues || [],
              suggestions: hr.validation?.suggestions || [],
              attempts: hr.validation?.attempts || 1,
              lead_score: hr.lead_score || 75,
              lead_priority: hr.lead_priority || 'medium',
              lead_reason: hr.lead_reason || 'Standard lead match',
              mode: hr.mode || 'genai'
            });
          });
        }
      });

      if (flattenedContacts.length === 0) {
        throw new Error('AI returned companies but no HR recruiter contacts inside.');
      }

      // Merge new contacts with existing ones (avoiding duplicates by email)
      setContacts(prev => {
        const existingEmails = new Set(prev.map(c => c.hr_email.toLowerCase()).filter(Boolean));
        const filteredNew = flattenedContacts.filter(c => !c.hr_email || !existingEmails.has(c.hr_email.toLowerCase()));
        return [...filteredNew, ...prev];
      });

      // Switch to tracker tab to see results
      setActiveTab('tracker');
      
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Regenerate a single contact email
  const handleRegenerateEmail = async (contactId, overrideMode = null) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const activeMode = overrideMode || contact.mode || 'genai';

    // Set temporary state for loading
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isRegenerating: true, mode: activeMode } : c));

    try {
      // First, get the regenerated email from the backend
      const response = await fetch(`${API_BASE_URL}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hrName: contact.hr_name,
          company: contact.company,
          role: searchRole || profile.targetRole || 'Software Engineer',
          profile: profile,
          previousSubject: contact.subject,
          previousBody: contact.body,
          issues: contact.issues || [],
          suggestions: contact.suggestions || [],
          mode: activeMode,
          geminiKeyOverride: geminiKey
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to regenerate');

      const newSubject = result.subject || contact.subject;
      const newBody = result.body || contact.body;

      // Second, run validation on the newly regenerated email!
      const valResponse = await fetch(`${API_BASE_URL}/validate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject,
          body: newBody,
          company: contact.company,
          role: searchRole || profile.targetRole || 'Software Engineer',
          mode: activeMode
        })
      });

      const valResult = await valResponse.json();
      const valData = valResponse.ok ? valResult : { score: 70, verdict: 'okay', issues: [], fix_suggestions: [] };

      // Third, run lead scoring with the new email validation score!
      const scoreResponse = await fetch(`${API_BASE_URL}/score-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: contact.company,
          role: searchRole || profile.targetRole || 'Software Engineer',
          hr_title: contact.hr_title || 'Recruiter',
          email: contact.hr_email,
          email_score: valData.score || 70,
          mode: activeMode
        })
      });

      const scoreResult = await scoreResponse.json();
      const scoreData = scoreResponse.ok ? scoreResult : { lead_score: contact.lead_score || 75, priority: contact.lead_priority || 'medium', reason: contact.lead_reason || 'Standard lead match' };

      setContacts(prev => prev.map(c => {
        if (c.id === contactId) {
          const encodedTo = encodeURIComponent(c.hr_email);
          const encodedSubject = encodeURIComponent(newSubject);
          const encodedBody = encodeURIComponent(newBody);
          const newUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
          
          return {
            ...c,
            subject: newSubject,
            body: newBody,
            gmail_compose_url: newUrl,
            score: valData.score || 70,
            verdict: valData.verdict || 'okay',
            issues: valData.issues || [],
            suggestions: valData.fix_suggestions || [],
            attempts: (c.attempts || 1) + 1,
            lead_score: scoreData.lead_score || 75,
            lead_priority: scoreData.priority || 'medium',
            lead_reason: scoreData.reason || 'Standard lead match',
            mode: activeMode,
            isRegenerating: false
          };
        }
        return c;
      }));
    } catch (err) {
      alert(`Regeneration failed: ${err.message}`);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isRegenerating: false } : c));
    }
  };

  // Analyze Recruiter Reply
  const handleAnalyzeReply = async (contactId, replyText) => {
    if (!replyText || !replyText.trim()) return;

    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isAnalyzingReply: true } : c));

    try {
      const response = await fetch(`${API_BASE_URL}/analyze-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyText,
          geminiKeyOverride: geminiKey
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to analyze reply');

      setContacts(prev => prev.map(c => {
        if (c.id === contactId) {
          return {
            ...c,
            replyAnalysisResult: result,
            isAnalyzingReply: false,
            // If reply is positive/neutral, auto-update to replied
            status: result.intent === 'positive' ? 'replied' : (result.intent === 'neutral' ? 'replied' : c.status)
          };
        }
        return c;
      }));
    } catch (err) {
      alert(`Analysis failed: ${err.message}`);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isAnalyzingReply: false } : c));
    }
  };

  // Generate Follow-up
  const handleGenerateFollowup = async (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isGeneratingFollowup: true } : c));

    try {
      const response = await fetch(`${API_BASE_URL}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hrName: contact.hr_name,
          company: contact.company,
          role: searchRole || profile.targetRole || 'Software Engineer',
          profile: profile,
          previousSubject: contact.subject,
          previousBody: contact.body,
          geminiKeyOverride: geminiKey
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to generate follow-up');

      setContacts(prev => prev.map(c => {
        if (c.id === contactId) {
          const encodedTo = encodeURIComponent(c.hr_email);
          const encodedSubject = encodeURIComponent(result.subject);
          const encodedBody = encodeURIComponent(result.body);
          const followupGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;

          return {
            ...c,
            followupSubject: result.subject,
            followupBody: result.body,
            followupGmailUrl,
            isGeneratingFollowup: false,
            showFollowupSection: true
          };
        }
        return c;
      }));
    } catch (err) {
      alert(`Follow-up generation failed: ${err.message}`);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, isGeneratingFollowup: false } : c));
    }
  };

  // Export database to CSV
  const downloadCSV = () => {
    if (contacts.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = ['Company', 'Industry', 'HR Name', 'HR Email', 'Email Confidence', 'LinkedIn', 'Status', 'Notes', 'Last Applied'];
    const rows = contacts.map(c => [
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${(c.industry || '').replace(/"/g, '""')}"`,
      `"${(c.hr_name || '').replace(/"/g, '""')}"`,
      `"${(c.hr_email || '').replace(/"/g, '""')}"`,
      c.hr_email_confidence || '',
      `"${(c.hr_linkedin || '').replace(/"/g, '""')}"`,
      c.status || '',
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      c.last_sent_at ? new Date(c.last_sent_at).toLocaleDateString() : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'outreach_leads_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Update Status Dropdown
  const handleStatusChange = (contactId, newStatus) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        return {
          ...c,
          status: newStatus,
          last_sent_at: newStatus === 'sent' ? new Date().toISOString() : c.last_sent_at
        };
      }
      return c;
    }));
  };

  // Update Notes Inline
  const handleNotesChange = (contactId, newNotes) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes: newNotes } : c));
  };

  // Update Editable Subject
  const handleSubjectChange = (contactId, newSubject) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        const encodedTo = encodeURIComponent(c.hr_email);
        const encodedSubject = encodeURIComponent(newSubject);
        const encodedBody = encodeURIComponent(c.body);
        return {
          ...c,
          subject: newSubject,
          gmail_compose_url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`
        };
      }
      return c;
    }));
  };

  // Update Editable Body
  const handleBodyChange = (contactId, newBody) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        const encodedTo = encodeURIComponent(c.hr_email);
        const encodedSubject = encodeURIComponent(c.subject);
        const encodedBody = encodeURIComponent(newBody);
        return {
          ...c,
          body: newBody,
          gmail_compose_url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`
        };
      }
      return c;
    }));
  };

  // Trigger Send: Dispatches via Gmail API if enabled, otherwise opens compose link
  const handleSendEmail = async (contactId, isConfirmed = false) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // Check daily limit
    const todayString = new Date().toDateString();
    const sentToday = historyLogs.filter(log => {
      const logDate = new Date(log.created_at || log.timestamp).toDateString();
      return logDate === todayString && (log.status === 'sent' || log.status === 'replied' || log.status === 'interview');
    }).length;

    if (sentToday >= dailyLimit) {
      alert(`Daily limit of ${dailyLimit} emails reached! Let's pause for today to maintain healthy domains.`);
      return;
    }

    // Check delay cooldown
    if (isDelayActive) {
      alert(`Please wait for the cooldown timer (${cooldownTimer}s) to expire before sending another email.`);
      return;
    }

    // Check confirmation modal (for manual review mode)
    if (!autoSend && !isConfirmed) {
      setPendingSendContactId(contactId);
      setShowConfirmModal(true);
      return;
    }

    let success = true;
    let errMsg = '';

    if (useGmailApi) {
      setIsLoading(true);
      setLoadingStep('Sending email via Gmail API...');
      try {
        const response = await fetch(`${API_BASE_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: contact.hr_email,
            subject: contact.subject,
            body: contact.body
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to dispatch email');
        }
        alert('Email sent successfully via Gmail API!');
      } catch (err) {
        success = false;
        errMsg = err.message;
        alert('Failed to send email via API: ' + err.message);
      } finally {
        setIsLoading(false);
        setLoadingStep('');
      }
    } else {
      // Traditional compose redirect
      if (contact.gmail_compose_url) {
        window.open(contact.gmail_compose_url, '_blank');
      } else {
        window.open(`mailto:${contact.hr_email}?subject=${encodeURIComponent(contact.subject)}&body=${encodeURIComponent(contact.body)}`, '_blank');
      }
    }

    if (success) {
      const timestamp = new Date().toISOString();
      setContacts(prev => prev.map(c => {
        if (c.id === contactId) {
          return {
            ...c,
            status: 'sent',
            last_sent_at: timestamp
          };
        }
        return c;
      }));

      // Log Outreach Attempt in Backend
      try {
        await fetch(`${API_BASE_URL}/log-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contact.id,
            company: contact.company,
            hr_name: contact.hr_name,
            hr_email: contact.hr_email,
            subject: contact.subject,
            body: contact.body,
            status: 'sent',
            notes: contact.notes || (useGmailApi ? 'Sent directly via Gmail API' : 'Sent via Gmail compose link')
          })
        });
        fetchHistory(); // Refresh logs to update sent count immediately
      } catch (err) {
        console.error('Failed to log outreach to backend:', err);
      }

      // Start 25-second cooldown delay
      setIsDelayActive(true);
      let timeLeft = 25;
      setCooldownTimer(timeLeft);
      const interval = setInterval(() => {
        timeLeft -= 1;
        setCooldownTimer(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(interval);
          setIsDelayActive(false);
        }
      }, 1000);

      // Auto-Send Flow
      if (autoSend) {
        const nextContact = contacts.find(c => c.id !== contactId && c.status === 'not_applied');
        if (nextContact) {
          // Trigger after the cooldown ends
          setTimeout(() => {
            handleSendEmail(nextContact.id);
          }, 25500);
        } else {
          alert("Auto-Send completed! No more contacts to send.");
        }
      }
    } else {
      // Mark as failed
      setContacts(prev => prev.map(c => {
        if (c.id === contactId) {
          return {
            ...c,
            status: 'failed',
            notes: `Email failed — retry. Error: ${errMsg}`
          };
        }
        return c;
      }));

      // Log Failed Attempt in Backend
      try {
        await fetch(`${API_BASE_URL}/log-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contact.id,
            company: contact.company,
            hr_name: contact.hr_name,
            hr_email: contact.hr_email,
            subject: contact.subject,
            body: contact.body,
            status: 'failed',
            notes: `Failed: ${errMsg}`
          })
        });
        fetchHistory();
      } catch (err) {
        console.error('Failed to log failure to backend:', err);
      }
    }
  };

  // Trigger Send for Follow-up email
  const handleSendFollowup = async (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || !contact.followupSubject || !contact.followupBody) return;

    // Check daily limit
    const todayString = new Date().toDateString();
    const sentToday = historyLogs.filter(log => {
      const logDate = new Date(log.created_at || log.timestamp).toDateString();
      return logDate === todayString && (log.status === 'sent' || log.status === 'replied' || log.status === 'interview');
    }).length;

    if (sentToday >= dailyLimit) {
      alert(`Daily limit of ${dailyLimit} emails reached! Let's pause for today.`);
      return;
    }

    // Check delay cooldown
    if (isDelayActive) {
      alert(`Please wait for the cooldown timer (${cooldownTimer}s) to expire before sending.`);
      return;
    }

    let success = true;
    let errMsg = '';

    if (useGmailApi) {
      setIsLoading(true);
      setLoadingStep('Sending follow-up email via Gmail API...');
      try {
        const response = await fetch(`${API_BASE_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: contact.hr_email,
            subject: contact.followupSubject,
            body: contact.followupBody
          })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to dispatch follow-up email');
        }
        alert('Follow-up email sent successfully!');
      } catch (err) {
        success = false;
        errMsg = err.message;
        alert('Failed to send follow-up: ' + err.message);
      } finally {
        setIsLoading(false);
        setLoadingStep('');
      }
    } else {
      window.open(contact.followupGmailUrl, '_blank');
    }

    if (success) {
      handleStatusChange(contactId, 'sent');

      try {
        await fetch(`${API_BASE_URL}/log-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contact.id + '-followup',
            company: contact.company,
            hr_name: contact.hr_name,
            hr_email: contact.hr_email,
            subject: contact.followupSubject,
            body: contact.followupBody,
            status: 'sent',
            notes: 'Sent follow-up message.'
          })
        });
        fetchHistory();
      } catch (err) {
        console.error('Failed to log follow-up:', err);
      }

      // Start 25-second cooldown delay
      setIsDelayActive(true);
      let timeLeft = 25;
      setCooldownTimer(timeLeft);
      const interval = setInterval(() => {
        timeLeft -= 1;
        setCooldownTimer(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(interval);
          setIsDelayActive(false);
        }
      }, 1000);
    }
  };

  // Delete contact card
  const handleDeleteContact = (contactId) => {
    if (window.confirm('Remove this lead from your tracker?')) {
      setContacts(prev => {
        const updated = prev.filter(c => c.id !== contactId);
        if (activeCardIndex >= updated.length) {
          setActiveCardIndex(Math.max(0, updated.length - 1));
        }
        return updated;
      });
    }
  };

  // Clear Database
  const handleClearAll = () => {
    if (window.confirm('Reset all contacts and tracking data? This cannot be undone.')) {
      setContacts([]);
      localStorage.removeItem('outreach_contacts');
    }
  };

  // --- STATS CALCULATION ---
  const stats = contacts.reduce((acc, curr) => {
    acc.total += 1;
    if (curr.status === 'not_applied') acc.notApplied += 1;
    if (curr.status === 'sent') acc.sent += 1;
    if (curr.status === 'replied') acc.replied += 1;
    if (curr.status === 'interview') acc.interview += 1;
    if (curr.status === 'invalid_contact') acc.invalid += 1;
    return acc;
  }, { total: 0, notApplied: 0, sent: 0, replied: 0, interview: 0, invalid: 0 });

  const totalSent = stats.sent + stats.replied + stats.interview;
  const totalReplies = stats.replied + stats.interview;
  const responseRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : '0.0';
  const interviewRate = totalSent > 0 ? ((stats.interview / totalSent) * 100).toFixed(1) : '0.0';

  const totalOutreachProgress = stats.sent + stats.replied + stats.interview;
  const targetOutreach = 100;
  const progressPercent = Math.min(Math.round((totalOutreachProgress / targetOutreach) * 100), 100);

  const todayString = new Date().toDateString();
  const sentToday = historyLogs.filter(log => {
    const logDate = new Date(log.created_at || log.timestamp).toDateString();
    return logDate === todayString && (log.status === 'sent' || log.status === 'replied' || log.status === 'interview');
  }).length;

  return (
    <div className="app-container">
      {/* HEADER */}
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>
            <span style={{ fontSize: '2.5rem' }}>🚀</span>
            Nandini Outreach Agent
          </h1>
          <p className="sub-header" style={{ margin: 0 }}>
            Automated Cold Outreach Command Center for Tech Candidates.
            <span style={{ display: 'block', color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>
              ⚡ "Built an AI agent that automates job outreach end-to-end"
            </span>
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {contacts.length > 0 && (
            <button className="btn btn-secondary" onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ti ti-download" style={{ fontSize: '1.2rem' }}></i> Export CSV
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
            <i className="ti ti-settings" style={{ fontSize: '1.2rem' }}></i> Settings
          </button>
        </div>
      </header>

      {/* SETTINGS PANELS */}
      {showSettings && (
        <div className="glass-panel glowing-blue animate-slide-up" style={{ border: '1px solid rgba(59, 130, 246, 0.4)' }}>
          <div className="panel-title">
            <i className="ti ti-key" style={{ color: 'var(--accent-blue)' }}></i> Credentials & API Configuration
          </div>
          <form onSubmit={saveSettings}>
            <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
              <div>
                <label>Gemini API Key <span style={{ color: 'var(--accent-rose)', textTransform: 'none' }}>* (Override)</span></label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                  If empty, the server env variable <code>GEMINI_API_KEY</code> will be used.
                </p>
              </div>
              <div>
                <label>Serper.dev API Key <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>(Free 2500 requests)</span></label>
                <input
                  type="password"
                  placeholder="Enter Serper Dev Key..."
                  value={serperKey}
                  onChange={(e) => setSerperKey(e.target.value)}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                  Enables live Google search results for current job listings.
                </p>
              </div>
            </div>

            {/* Gmail Integration Section */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textTransform: 'none', fontWeight: '500' }}>
                    <input 
                      type="checkbox" 
                      checked={useGmailApi} 
                      onChange={(e) => setUseGmailApi(e.target.checked)} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Dispatch Outreach directly via Gmail API
                  </label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', marginLeft: '24px' }}>
                    Sends emails in one click using the backend integration instead of opening compose tabs.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleConnectGmail} style={{ padding: '0.5rem 1rem' }}>
                  <i className="ti ti-brand-google" style={{ color: 'var(--accent-rose)' }}></i> Connect Gmail
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary">Save Settings</button>
              <button type="button" className="btn btn-secondary" style={{ color: 'var(--accent-rose)' }} onClick={handleClearAll}>
                <i className="ti ti-trash"></i> Reset Database
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CORE NAVIGATION TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', marginBottom: '1.5rem', gap: '2rem' }}>
        <button 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'agent' ? '2.5px solid var(--accent-blue)' : '2.5px solid transparent',
            color: activeTab === 'agent' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('agent')}
        >
          <i className="ti ti-radar" style={{ fontSize: '1.1rem' }}></i> Discover Listings
        </button>
        <button 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tracker' ? '2.5px solid var(--accent-blue)' : '2.5px solid transparent',
            color: activeTab === 'tracker' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('tracker')}
        >
          <i className="ti ti-activity-heartbeat" style={{ fontSize: '1.1rem' }}></i> Application Tracker 
          {contacts.length > 0 && (
            <span style={{ fontSize: '0.75rem', background: 'var(--accent-blue)', color: 'white', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>
              {contacts.length}
            </span>
          )}
        </button>
        <button 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2.5px solid var(--accent-blue)' : '2.5px solid transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('history')}
        >
          <i className="ti ti-history" style={{ fontSize: '1.1rem' }}></i> Server Activity Log
        </button>
        <button 
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile-setting' ? '2.5px solid var(--accent-blue)' : '2.5px solid transparent',
            color: activeTab === 'profile-setting' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveTab('profile-setting')}
        >
          <i className="ti ti-id-badge" style={{ fontSize: '1.1rem' }}></i> Nandini Profile
        </button>
      </div>

      {/* TAB 1: DISCOVER AGENT */}
      {activeTab === 'agent' && (
        <div className="glass-panel animate-slide-up">
          <div className="panel-title">
            <i className="ti ti-search" style={{ color: 'var(--accent-blue)' }}></i> Discover & Enrich Target Companies
          </div>
          
          <form onSubmit={handleStartDiscovery} style={{ marginBottom: '1.5rem' }}>
            <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
              <div>
                <label>Target Role / Keyword</label>
                <input 
                  type="text" 
                  placeholder="e.g. GenAI Intern, Frontend Developer" 
                  required
                  value={searchRole}
                  onChange={(e) => setSearchRole(e.target.value)}
                />
              </div>
              <div>
                <label>Location Preference <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>(Optional)</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. San Francisco, Bangalore, Remote" 
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="autoSendToggle"
                checked={autoSend} 
                onChange={(e) => setAutoSend(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="autoSendToggle" style={{ margin: 0, textTransform: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🚀 <strong>Auto Send Mode</strong> (Sends emails automatically with a 25s delay; uncheck for Review First)
              </label>
            </div>

            {autoSend && !useGmailApi && (
              <p style={{ color: 'var(--accent-amber)', fontSize: '0.8rem', marginTop: '-0.75rem', marginBottom: '1.25rem', paddingLeft: '4px' }}>
                ⚠️ <strong>Note:</strong> Auto-Send is active but Gmail API is disabled. The system will open browser tabs with a 25s delay. Please allow pop-ups.
              </p>
            )}
            
            <button 
              type="submit" 
              className="btn btn-accent" 
              style={{ width: '100%', padding: '1rem' }}
              disabled={isLoading || !searchRole}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span> Running AI Outreach Agent Flow...
                </>
              ) : (
                <>
                  <i className="ti ti-cpu" style={{ fontSize: '1.2rem' }}></i> Launch Discovery Flow
                </>
              )}
            </button>
          </form>

          {/* AGENT LOGGING / PROGRESS STATS */}
          {isLoading && (
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {loadingStep}
              </div>
              <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', maxWidth: '400px', margin: '0 auto' }}>
                <div 
                  style={{
                    height: '100%',
                    background: 'var(--accent-blue)',
                    width: loadingStep.includes('Searching') ? '25%' : 
                           loadingStep.includes('Analyzing') ? '50%' : 
                           loadingStep.includes('recruiter') ? '75%' : '95%',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                This takes around 15-20 seconds to scan references, fetch HR logs and tailor unique email pitches.
              </p>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--accent-rose-glow)', border: '1px solid rgba(244,63,94,0.4)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize: '1.5rem' }}></i>
              <div>
                <strong>Error:</strong> {error}
                <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: '4px' }}>
                  Please verify your Gemini key settings or test with a simpler role.
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px dashed var(--border-medium)', textAlign: 'center' }}>
              <i className="ti ti-rocket" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}></i>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>Ready for takeoff</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto' }}>
                Input a role above to launch our multi-stage agent pipeline. The agent will run search, cross-reference companies, generate recruiters, and compose custom pitches.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TRACKER METRICS PANEL (Universal status dashboard) */}
      {contacts.length > 0 && (
        <section className="glass-panel glowing-blue animate-slide-up" style={{ padding: '1.25rem 1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            {/* Stats list */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', flex: 1 }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Leads</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Not Applied</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{stats.notApplied}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Emails Sent</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{stats.sent}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Sent Today</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: sentToday >= dailyLimit ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                  {sentToday} / {dailyLimit}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Replied</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-amber)' }}>{stats.replied}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Interviews</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-purple)' }}>{stats.interview}</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Response Rate</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{responseRate}%</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Conversion</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{interviewRate}%</div>
              </div>
              {stats.invalid > 0 && (
                <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Invalid Contact</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-rose)' }}>{stats.invalid}</div>
                </div>
              )}
            </div>

            {/* Circular/Line Progress bar to 100 outreach attempts */}
            <div style={{ minWidth: '220px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                <span>Outreach Goal (v1)</span>
                <span>{totalOutreachProgress} / {targetOutreach} ({progressPercent}%)</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
                <div 
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-emerald) 0%, var(--accent-blue) 100%)',
                    width: `${progressPercent}%`,
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                🚀 Goal: 100 manual cold outreach triggers. Keep pushing!
              </span>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: APPLICATION TRACKER (SSoT WORKSPACE) */}
      {activeTab === 'tracker' && (
        <div className="animate-slide-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Outreach Workspace & SSoT Tracker
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total leads: {contacts.length}
              </span>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <button 
                  onClick={() => setViewMode('slide')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'slide' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'slide' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <i className="ti ti-cards" style={{ marginRight: '4px' }}></i> Slide View
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'list' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <i className="ti ti-list" style={{ marginRight: '4px' }}></i> List View
                </button>
              </div>
            </div>
          </div>

          {contacts.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <i className="ti ti-mailbox" style={{ fontSize: '3.5rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}></i>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '6px' }}>No contacts found</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                Your outreach tracker is empty. Head over to the "Discover Listings" tab to generate leads using Gemini and Serper.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('agent')}>
                Go to Discovery
              </button>
            </div>
          ) : (
            <div>
              {/* Pagination controls for Slide View */}
              {viewMode === 'slide' && (
                <div className="glass-panel glowing-blue animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', marginBottom: '1.25rem', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setActiveCardIndex(prev => Math.max(0, prev - 1))}
                    disabled={activeCardIndex === 0}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <i className="ti ti-chevron-left"></i> Back
                  </button>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {contacts[activeCardIndex]?.company} ({activeCardIndex + 1} of {contacts.length})
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.5px' }}>
                      💡 Use Keyboard Left/Right Arrow keys to switch slides
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setActiveCardIndex(prev => Math.min(contacts.length - 1, prev + 1))}
                    disabled={activeCardIndex === contacts.length - 1}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Next <i className="ti ti-chevron-right"></i>
                  </button>
                </div>
              )}

              {/* Render contact card(s) */}
              {(viewMode === 'slide' ? [contacts[activeCardIndex] || contacts[0]] : contacts).map((c) => {
                if (!c) return null;
                
                // Determine card status color
                let borderGlowClass = '';
                if (c.status === 'sent') borderGlowClass = 'rgba(16, 185, 129, 0.2)';
                else if (c.status === 'replied') borderGlowClass = 'rgba(245, 158, 11, 0.2)';
                else if (c.status === 'interview') borderGlowClass = 'rgba(139, 92, 246, 0.2)';
                else if (c.status === 'invalid_contact') borderGlowClass = 'rgba(244, 63, 94, 0.2)';
                else if (c.status === 'failed') borderGlowClass = 'rgba(244, 63, 94, 0.35)';

                return (
                  <div 
                    key={c.id} 
                    className="glass-panel animate-slide-up"
                    style={{
                      borderLeft: `4px solid ${
                        c.status === 'sent' ? 'var(--accent-emerald)' :
                        c.status === 'replied' ? 'var(--accent-amber)' :
                        c.status === 'interview' ? 'var(--accent-purple)' :
                        c.status === 'invalid_contact' ? 'var(--accent-rose)' :
                        c.status === 'failed' ? 'var(--accent-rose)' :
                        'var(--accent-blue)'
                      }`,
                      boxShadow: borderGlowClass ? `0 0 15px ${borderGlowClass}` : undefined,
                      marginBottom: viewMode === 'list' ? '1.5rem' : '0'
                    }}
                  >
                    {/* Header info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.company}</span>
                          {c.lead_score && (
                            <span 
                              className={`badge ${
                                c.lead_priority === 'high' ? 'badge-emerald' : 
                                (c.lead_priority === 'medium' ? 'badge-amber' : 'badge-rose')
                              }`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700' }}
                              title={c.lead_reason}
                            >
                              🔥 Lead Score: {c.lead_score} ({c.lead_priority.toUpperCase()})
                            </span>
                          )}
                          {c.mode && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mode:</span>
                              <select 
                                value={c.mode}
                                onChange={(e) => handleRegenerateEmail(c.id, e.target.value)}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  borderRadius: '4px',
                                  borderColor: 'var(--border-strong)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  width: 'auto'
                                }}
                              >
                                <option value="genai">GenAI ⚡</option>
                                <option value="aiml">AI/ML 🧠</option>
                                <option value="cv">Vision 👁️</option>
                                <option value="robotics">Robotics 🤖</option>
                                <option value="automation">Automation ⚙️</option>
                              </select>
                            </div>
                          )}
                          {c.careers_url && (
                            <a href={c.careers_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <i className="ti ti-external-link"></i> Careers
                            </a>
                          )}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          Role Details & Contacts
                          {c.lead_reason && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                              ({c.lead_reason})
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Status select, last sent timestamp, delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {c.last_sent_at && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Applied: {new Date(c.last_sent_at).toLocaleDateString()}
                          </span>
                        )}
                        
                        <select 
                          value={c.status}
                          onChange={(e) => handleStatusChange(c.id, e.target.value)}
                          style={{
                            width: 'auto',
                            fontSize: '0.85rem',
                            padding: '0.4rem 1.8rem 0.4rem 0.8rem',
                            fontWeight: 600,
                            borderColor: 
                              c.status === 'sent' ? 'var(--accent-emerald)' :
                              c.status === 'replied' ? 'var(--accent-amber)' :
                              c.status === 'interview' ? 'var(--accent-purple)' :
                              c.status === 'invalid_contact' ? 'var(--accent-rose)' :
                              c.status === 'failed' ? 'var(--accent-rose)' :
                              'var(--border-strong)'
                          }}
                        >
                          <option value="not_applied">Not Applied</option>
                          <option value="sent">Email Sent</option>
                          <option value="replied">Replied</option>
                          <option value="interview">Interview Setup</option>
                          <option value="invalid_contact">Invalid / Bounce</option>
                          <option value="failed">Failed — Retry</option>
                        </select>

                        <button 
                          onClick={() => handleDeleteContact(c.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          title="Remove contact"
                        >
                          <i className="ti ti-trash" style={{ fontSize: '1.1rem' }}></i>
                        </button>
                      </div>
                    </div>

                    {/* HR Contact details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Recruiter Name</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{c.hr_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.hr_title}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Corporate Email</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{c.hr_email || 'No email available'}</span>
                          {c.hr_email && (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(c.hr_email);
                                alert('Email copied!');
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                              [Copy]
                            </button>
                          )}
                        </div>
                        <span className={`badge ${
                          c.hr_email_confidence === 'high' ? 'badge-emerald' : 
                          c.hr_email_confidence === 'medium' ? 'badge-amber' : 'badge-rose'
                        }`} style={{ marginTop: '4px', scale: '0.9', originX: 0 }}>
                          Confidence: {c.hr_email_confidence}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Professional URL</div>
                        <div style={{ marginTop: '2px' }}>
                          {c.hr_linkedin && c.hr_linkedin !== 'unknown' ? (
                            <a href={c.hr_linkedin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="ti ti-brand-linkedin"></i> Recruiter LinkedIn
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>LinkedIn Unknown</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Email Editor Block */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subject Line</label>
                      <input 
                        type="text" 
                        value={c.subject} 
                        onChange={(e) => handleSubjectChange(c.id, e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.15)', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }}
                      />
                      
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Email Body Draft (Builder Tone)</span>
                        <span style={{ fontSize: '0.75rem', fontStyle: 'italic', textTransform: 'none' }}>Edits are saved locally</span>
                      </label>
                      <textarea 
                        value={c.body} 
                        onChange={(e) => handleBodyChange(c.id, e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.15)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', minHeight: '160px', padding: '0.85rem' }}
                      />

                      {/* Validation Score & Details Display */}
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.75rem 1rem', 
                        borderRadius: '6px', 
                        background: (c.score || 80) >= 80 ? 'rgba(16, 185, 129, 0.05)' : ((c.score || 80) >= 60 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(244, 63, 94, 0.08)'), 
                        border: `1px solid ${
                          (c.score || 80) >= 80 ? 'rgba(16, 185, 129, 0.2)' : 
                          ((c.score || 80) >= 60 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(244, 63, 94, 0.3)')
                        }`,
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className={`ti ti-${(c.score || 80) >= 80 ? 'circle-check' : 'alert-triangle'}`} style={{ 
                              color: (c.score || 80) >= 80 ? 'var(--accent-emerald)' : ((c.score || 80) >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)'),
                              fontSize: '1rem'
                            }}></i>
                            AI Recruiter Review Score: <strong style={{ fontSize: '0.9rem' }}>{c.score || 80}/100</strong>
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Attempts: {c.attempts || 1} • Verdict: <strong style={{ 
                              color: (c.score || 80) >= 80 ? 'var(--accent-emerald)' : ((c.score || 80) >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)')
                            }}>{c.verdict ? c.verdict.toUpperCase() : 'OKAY'}</strong>
                          </span>
                        </div>

                        {c.issues && c.issues.length > 0 && (
                          <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                            <strong style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>Issues to Address:</strong>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {c.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {c.suggestions && c.suggestions.length > 0 && (
                          <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                            <strong style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>Fix Suggestions:</strong>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {c.suggestions.map((sug, idx) => (
                                <li key={idx}>{sug}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes field */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tracking Notes</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Replied asking for portfolio, scheduled interview for 30th May..."
                        value={c.notes}
                        onChange={(e) => handleNotesChange(c.id, e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', borderStyle: 'dashed' }}
                      />
                    </div>

                    {/* Follow-up & Response Analytics Workspace */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1.25rem', marginBottom: '1.25rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
                      {/* Left: Follow-up Pitch Generator */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="ti ti-mail-forward" style={{ color: 'var(--accent-blue)' }}></i> Follow-up Generation
                          </span>
                          {c.followupBody && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>Draft Ready</span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Generate a polite, 50-word follow-up message referencing your previous email draft.
                        </p>
                        
                        {!c.followupBody ? (
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}
                            onClick={() => handleGenerateFollowup(c.id)}
                            disabled={c.isGeneratingFollowup}
                          >
                            {c.isGeneratingFollowup ? (
                              <>
                                <span className="spinner" style={{ width: '12px', height: '12px' }}></span> Drafting...
                              </>
                            ) : (
                              <>
                                <i className="ti ti-sparkles"></i> Generate Follow-up
                              </>
                            )}
                          </button>
                        ) : (
                          <div>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-light)', marginBottom: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                              <strong>Subject:</strong> {c.followupSubject}<br/><br/>
                              {c.followupBody}
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{
                                  flex: 1,
                                  padding: '0.4rem',
                                  fontSize: '0.75rem',
                                  background: isDelayActive ? 'var(--bg-tertiary)' : 'var(--accent-blue)'
                                }}
                                onClick={() => handleSendFollowup(c.id)}
                                disabled={isDelayActive}
                              >
                                <i className="ti ti-brand-gmail"></i> {isDelayActive ? `Cooldown (${cooldownTimer}s)` : 'Send Follow-up'}
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(`Subject: ${c.followupSubject}\n\n${c.followupBody}`);
                                  alert('Follow-up draft copied!');
                                }}
                              >
                                <i className="ti ti-copy"></i> Copy
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', fontSize: '0.75rem', color: 'var(--accent-rose)' }}
                                onClick={() => {
                                  setContacts(prev => prev.map(item => item.id === c.id ? { ...item, followupBody: null } : item));
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Response Analysis feedback loop */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <i className="ti ti-brain" style={{ color: 'var(--accent-amber)' }}></i> Response Analysis
                        </span>
                        
                        {!c.replyAnalysisResult ? (
                          <div>
                            <textarea 
                              placeholder="Paste recruiter's reply email here to analyze sentiment and action..."
                              style={{ background: 'rgba(0,0,0,0.15)', fontSize: '0.75rem', minHeight: '60px', padding: '6px', marginBottom: '8px', resize: 'vertical' }}
                              id={`reply-input-${c.id}`}
                            />
                            <button 
                              className="btn btn-secondary" 
                              style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                const text = document.getElementById(`reply-input-${c.id}`)?.value;
                                if (text) {
                                  handleAnalyzeReply(c.id, text);
                                } else {
                                  alert('Please paste some text to analyze.');
                                }
                              }}
                              disabled={c.isAnalyzingReply}
                            >
                              {c.isAnalyzingReply ? (
                                <>
                                  <span className="spinner" style={{ width: '12px', height: '12px' }}></span> Analyzing...
                                </>
                              ) : (
                                <>
                                  <i className="ti ti-search"></i> Classify Reply
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.75rem' }}>
                              <span>Intent: 
                                <strong style={{ 
                                  marginLeft: '4px',
                                  color: c.replyAnalysisResult.intent === 'positive' ? 'var(--accent-emerald)' : 
                                         (c.replyAnalysisResult.intent === 'negative' ? 'var(--accent-rose)' : 'var(--accent-amber)')
                                }}>
                                  {c.replyAnalysisResult.intent.toUpperCase()}
                                </strong>
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>Confidence: {Math.round(c.replyAnalysisResult.confidence * 100)}%</span>
                            </div>
                            
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-light)', marginBottom: '8px' }}>
                              <strong>Recommended Next Step:</strong><br/>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {c.replyAnalysisResult.next_action === 'schedule_call' ? '📞 Schedule call / calendar link response' : 
                                 (c.replyAnalysisResult.next_action === 'follow_up' ? '✉️ Generate context follow-up' : '🛑 Ignore or archive lead')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              {c.replyAnalysisResult.next_action === 'schedule_call' && (
                                <button 
                                  className="btn btn-primary" 
                                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', background: 'var(--accent-purple)' }}
                                  onClick={() => handleStatusChange(c.id, 'interview')}
                                >
                                  Mark Interview Setup
                                </button>
                              )}
                              {c.replyAnalysisResult.next_action === 'follow_up' && (
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', borderColor: 'var(--accent-blue)' }}
                                  onClick={() => handleGenerateFollowup(c.id)}
                                >
                                  Generate Follow-up
                                </button>
                              )}
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.4rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setContacts(prev => prev.map(item => item.id === c.id ? { ...item, replyAnalysisResult: null } : item));
                                }}
                              >
                                Reset Analysis
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleRegenerateEmail(c.id)}
                          disabled={c.isRegenerating || !c.hr_email}
                        >
                          {c.isRegenerating ? (
                            <>
                              <span className="spinner" style={{ width: '12px', height: '12px' }}></span> Regenerating...
                            </>
                          ) : (
                            <>
                              <i className="ti ti-refresh"></i> Regenerate Pitch
                            </>
                          )}
                        </button>
                        
                        <button 
                          className="btn btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(`Subject: ${c.subject}\n\n${c.body}`);
                            alert('Subject and Body copied to clipboard!');
                          }}
                        >
                          <i className="ti ti-copy"></i> Copy Draft
                        </button>
                      </div>

                      {c.status === 'invalid_contact' ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                          ⚠️ Flagged as Invalid Contact (Bounce risk)
                        </span>
                      ) : (c.score || 80) < 60 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                          ⚠️ Pitch score too low ({c.score}/100) to send. Click "Regenerate Pitch" to fix.
                        </span>
                      ) : (c.lead_score || 75) < 60 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                          ⚠️ Lead probability score too low ({c.lead_score}/100) to send.
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {(c.score || 80) < 80 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontStyle: 'italic', maxWidth: '180px', textAlign: 'right' }}>
                              ⚠️ Pitch score is {c.score}/100.
                            </span>
                          )}
                          {(c.lead_score || 75) >= 60 && (c.lead_score || 75) <= 75 && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontStyle: 'italic', maxWidth: '180px', textAlign: 'right' }}>
                              ⚠️ Lead score is {c.lead_score}/100. Manual review recommended.
                            </span>
                          )}
                          <button 
                            className="btn btn-primary"
                            style={{
                              background: isDelayActive ? 'var(--bg-tertiary)' : (c.status === 'sent' ? 'var(--accent-emerald)' : (c.status === 'failed' ? 'var(--accent-rose)' : 'var(--accent-blue)')),
                              boxShadow: !isDelayActive && c.status === 'sent' ? '0 4px 14px rgba(16,185,129,0.3)' : undefined
                            }}
                            onClick={() => handleSendEmail(c.id)}
                            disabled={!c.hr_email || isDelayActive}
                          >
                            <i className="ti ti-send"></i> 
                            {isDelayActive ? `Cooldown (${cooldownTimer}s)` : (c.status === 'sent' ? 'Send Again (Compose Tab)' : (c.status === 'failed' ? 'Retry Failed Send' : 'Send Email (Compose Tab)'))}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SERVER HISTORY LOG */}
      {activeTab === 'history' && (
        <div className="glass-panel animate-slide-up">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="ti ti-history" style={{ color: 'var(--accent-amber)' }}></i>
              Logged Outreach Attempts (Backend Database)
            </span>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchHistory}>
              <i className="ti ti-refresh"></i> Refresh
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            This log displays physical events recorded on the server system. Each time you trigger "Send Email", an entry is appended to <code>outreach_log.json</code>.
          </p>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <span className="spinner"></span> Loading history logs from server...
            </div>
          ) : historyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px dashed var(--border-medium)' }}>
              <i className="ti ti-archive" style={{ fontSize: '2rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}></i>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No server outreach logs found. Start sending emails to log activity.</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem' }}>Timestamp</th>
                    <th style={{ padding: '0.75rem' }}>Company</th>
                    <th style={{ padding: '0.75rem' }}>HR Contact</th>
                    <th style={{ padding: '0.75rem' }}>Target Email</th>
                    <th style={{ padding: '0.75rem' }}>Subject Line</th>
                    <th style={{ padding: '0.75rem' }}>Logged Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{log.company}</td>
                      <td style={{ padding: '0.75rem' }}>{log.hr_name}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{log.hr_email}</td>
                      <td style={{ padding: '0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.subject}>
                        {log.subject}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>{log.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROFILE SETTINGS */}
      {activeTab === 'profile-setting' && (
        <div className="glass-panel animate-slide-up">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="ti ti-id-badge" style={{ color: 'var(--accent-purple)' }}></i>
              Nandini Outreach Profile (Supabase Sync)
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Configure candidate details, technical skills, target role, and cold email tone. Any edits made here can be saved directly to your Supabase cloud database.
          </p>

          <form onSubmit={saveProfileToDb}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label>Full Name</label>
                <input 
                  type="text" 
                  name="name" 
                  placeholder="Nandini Khandelwal" 
                  value={profile.name} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>Degree & Branch</label>
                <input 
                  type="text" 
                  name="degree" 
                  placeholder="B.Tech Computer Science 2025" 
                  value={profile.degree} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>College/University</label>
                <input 
                  type="text" 
                  name="college" 
                  placeholder="NIT Warangal" 
                  value={profile.college} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>CGPA / Percentage</label>
                <input 
                  type="text" 
                  name="cgpa" 
                  placeholder="9.2 CGPA" 
                  value={profile.cgpa} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>Target Outreach Role</label>
                <input 
                  type="text" 
                  name="targetRole" 
                  placeholder="GenAI Intern / Software Engineer" 
                  value={profile.targetRole} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>LinkedIn URL</label>
                <input 
                  type="text" 
                  name="linkedin" 
                  placeholder="linkedin.com/in/nandinikh" 
                  value={profile.linkedin} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>GitHub / Portfolio URL</label>
                <input 
                  type="text" 
                  name="github" 
                  placeholder="github.com/nandini" 
                  value={profile.github} 
                  onChange={handleProfileChange}
                />
              </div>
              <div>
                <label>Outreach Tone (Important)</label>
                <input 
                  type="text" 
                  name="tone" 
                  placeholder="e.g. confident, builder, not desperate" 
                  value={profile.tone || ''} 
                  onChange={handleProfileChange}
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label>Core Technical Skills</label>
                <textarea 
                  name="skills" 
                  placeholder="React, Node.js, Python, LangChain, PyTorch, SQL, AWS..." 
                  style={{ minHeight: '80px' }}
                  value={profile.skills} 
                  onChange={handleProfileChange}
                ></textarea>
              </div>
              <div>
                <label>Major Projects & Achievements</label>
                <textarea 
                  name="projects" 
                  placeholder="Built an LLM agent that automates SQL queries with 94% accuracy..." 
                  style={{ minHeight: '80px' }}
                  value={profile.projects} 
                  onChange={handleProfileChange}
                ></textarea>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                💡 Overwriting fields updates your candidate profile data. Click save to upload to Supabase.
              </p>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSavingProfile}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                {isSavingProfile ? 'Saving...' : 'Save to Supabase'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel glowing-blue animate-slide-up" style={{
            maxWidth: '500px',
            width: '90%',
            padding: '2rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid rgba(59, 130, 246, 0.4)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-mail-forward" style={{ color: 'var(--accent-blue)', fontSize: '1.5rem' }}></i>
              Confirm Outreach Send
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Are you sure you want to send this email to <strong>{contacts.find(c => c.id === pendingSendContactId)?.hr_name}</strong> at <strong>{contacts.find(c => c.id === pendingSendContactId)?.company}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingSendContactId(null);
                }}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowConfirmModal(false);
                  handleSendEmail(pendingSendContactId, true);
                }}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Confirm & Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
