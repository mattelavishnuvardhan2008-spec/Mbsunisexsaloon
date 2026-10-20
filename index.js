const express = require('express');
const path = require('path');
const { nanoid } = require('nanoid');
const { kv } = require('@vercel/kv');

const app = express();

const APPOINTMENTS_KEY = 'appointments';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the project root (index.html, css, js, etc.)
app.use(express.static(__dirname));

app.post('/api/appointments', async (req, res) => {
  const { name, phone, service, date, time, notes } = req.body;
  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const appointment = {
    id: nanoid(),
    name,
    phone,
    service,
    date,
    time,
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  // Push appointment onto a KV list — persists across requests/instances
  await kv.rpush(APPOINTMENTS_KEY, JSON.stringify(appointment));

  res.json({ success: true, appointment });
});

app.get('/api/admin/appointments', async (req, res) => {
  const auth = req.headers.authorization;
  const ownerKey = process.env.ADMIN_KEY;

  if (!ownerKey) {
    return res.status(500).json({ error: 'ADMIN_KEY not configured' });
  }
  if (!auth || auth !== `Bearer ${ownerKey}`) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const raw = await kv.lrange(APPOINTMENTS_KEY, 0, -1);
  const appointments = raw.map((item) =>
    typeof item === 'string' ? JSON.parse(item) : item
  );

  res.json({ appointments });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

module.exports = app;
