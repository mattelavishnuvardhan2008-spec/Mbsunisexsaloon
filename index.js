const express = require('express');
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// Helper function to make requests to the Cloudflare D1 Worker
const callD1Worker = async (method, body = null) => {
  const workerUrl = process.env.WORKER_URL;
  const proxySecret = process.env.PROXY_SECRET;
  
  if (!workerUrl || !proxySecret) {
    throw new Error('Server missing WORKER_URL or PROXY_SECRET environment variables');
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${proxySecret}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(workerUrl, options);
  const text = await response.text(); // Get text first to prevent JSON parsing crashes
  
  try {
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(data.error || 'Worker request failed');
    return data;
  } catch (err) {
    throw new Error(`Worker Error (${response.status}): ${text.substring(0, 50)}...`);
  }
};

// POST: Book an appointment
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

  try {
    await callD1Worker('POST', appointment);
    res.json({ success: true, appointment });
  } catch (error) {
    console.error('Booking error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET: Admin - load appointments
app.get('/api/admin/appointments', async (req, res) => {
  const auth = req.headers.authorization;
  const ownerKey = process.env.ADMIN_KEY;

  if (!ownerKey) {
    return res.status(500).json({ error: 'ADMIN_KEY not configured on server' });
  }
  if (!auth || auth !== `Bearer ${ownerKey}`) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }

  try {
    const data = await callD1Worker('GET');
    res.json({ appointments: data.appointments || [] });
  } catch (error) {
    console.error('Admin load error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Admin - delete all appointments
app.delete('/api/admin/appointments', async (req, res) => {
  const auth = req.headers.authorization;
  const ownerKey = process.env.ADMIN_KEY;

  if (!ownerKey || !auth || auth !== `Bearer ${ownerKey}`) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }

  try {
    await callD1Worker('DELETE');
    res.json({ success: true, message: 'All appointments cleared.' });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

module.exports = app;
