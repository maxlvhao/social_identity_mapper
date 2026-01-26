const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

// Get session data
app.get('/api/session/:id', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'Session not found' });
    } else {
      res.status(500).json({ error: 'Failed to read session' });
    }
  }
});

// Save session data
app.post('/api/session/:id', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);

  const sessionData = {
    ...req.body,
    sessionId,
    updatedAt: new Date().toISOString()
  };

  if (!sessionData.createdAt) {
    sessionData.createdAt = sessionData.updatedAt;
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
    res.json({ success: true, sessionId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Download session as file
app.get('/api/session/:id/download', async (req, res) => {
  const sessionId = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(DATA_DIR, `${sessionId}.json`);

  try {
    const data = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.json"`);
    res.send(data);
  } catch (err) {
    res.status(404).json({ error: 'Session not found' });
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
