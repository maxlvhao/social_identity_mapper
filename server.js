const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Load .env in local development only (Vercel sets env vars directly)
try { require('dotenv').config({ override: false }); } catch (e) { /* no dotenv, using process.env */ }

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Get session data
app.get('/api/session/:id', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('data')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 = no rows returned
        return res.status(404).json({ error: 'Session not found' });
      }
      throw error;
    }

    res.json(data.data);
  } catch (err) {
    console.error('Failed to read session:', err.message);
    res.status(500).json({ error: 'Failed to read session' });
  }
});

// Save session data
app.post('/api/session/:id', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');

  const sessionData = {
    ...req.body,
    sessionId,
    updatedAt: new Date().toISOString()
  };

  if (!sessionData.createdAt) {
    sessionData.createdAt = sessionData.updatedAt;
  }

  try {
    const { error } = await supabase
      .from('sessions')
      .upsert({
        session_id: sessionId,
        data: sessionData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id'
      });

    if (error) throw error;

    res.json({ success: true, sessionId });
  } catch (err) {
    console.error('Failed to save session:', err.message);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Download session as file
app.get('/api/session/:id/download', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('data')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' });
      }
      throw error;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.json"`);
    res.send(JSON.stringify(data.data, null, 2));
  } catch (err) {
    console.error('Failed to download session:', err.message);
    res.status(404).json({ error: 'Session not found' });
  }
});

// List all sessions (for researcher view)
app.get('/api/sessions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('session_id, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Failed to list sessions:', err.message);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get survey response data for a session
app.get('/api/session/:id/survey', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');

  try {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('data')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'No survey data found' });
      }
      throw error;
    }

    res.json(data.data);
  } catch (err) {
    console.error('Failed to read survey data:', err.message);
    res.status(500).json({ error: 'Failed to read survey data' });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Social Identity Map server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}?session=test123 to start`);
});
