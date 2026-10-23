const express = require('express');
const path = require('path');
const { nanoid } = require('nanoid');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

const callD1Worker = async (method, body = null) => {
  const workerUrl = process.env.WORKER_URL;
  const proxySecret = process.env.PROXY_SECRET;
  
  if (!workerUrl || !proxySecret) throw new Error('Missing ENV vars');

  const options = {
    method,
    headers: { 'Authorization': `Bearer ${proxySecret}`, 'Content-Type': 'application/json' }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(workerUrl, options);
  const text = await response.text(); 
  
  try {
    const data = JSON.parse(text);
    if (!response.ok) throw new Error(data.error || 'Worker request failed');
    return data;
  } catch (err) {
    throw new Error(`Worker Error (${response.status}): ${text.substring(0, 50)}...`);
  }
};

app.post('/api/appointments', async (req, res) => {
  const { name, phone, service, date, time, notes } = req.body;
  
  if (!name || !phone || !service || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (name.length > 50) return res.status(400).json({ error: 'Name cannot exceed 50 characters' });
  if (phone.length > 10) return res.status(400).json({ error: 'Phone cannot exceed 10 characters' });
  if (notes && notes.length > 100) return res.status(400).json({ error: 'Notes cannot exceed 100 characters' });

  // Server-side time validation
  if (time < '09:00' || time > '22:00') {
    return res.status(400).json({ error: 'Bookings are only available between 9:00 AM and 10:00 PM.' });
  }

  const appointment = {
    id: nanoid(), name, phone, service, date, time, notes: notes || '', createdAt: new Date().toISOString()
  };

  try {
    const result = await callD1Worker('POST', appointment);
    res.json({ success: true, appointment, chair: result.chair });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/appointments', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_KEY || !auth || auth !== `Bearer ${process.env.ADMIN_KEY}`) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }
  try {
    const data = await callD1Worker('GET');
    res.json({ appointments: data.appointments || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/appointments', async (req, res) => {
  const auth = req.headers.authorization;
  if (!process.env.ADMIN_KEY || !auth || auth !== `Bearer ${process.env.ADMIN_KEY}`) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }
  try {
    await callD1Worker('DELETE');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

module.exports = app;
