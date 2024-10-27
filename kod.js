// server.js
const express = require('express');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
app.use(express.json());

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
client.connect();

// Middleware to authenticate using OAuth2 token
async function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.AUTH0_CLIENT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// Route to generate ticket
app.post('/generate-ticket', authenticateToken, async (req, res) => {
  const { vatin, firstName, lastName } = req.body;

  try {
    const ticketCount = await client.query('SELECT COUNT(*) FROM tickets WHERE vatin = $1', [vatin]);
    if (ticketCount.rows[0].count >= 3) {
      return res.status(400).json({ error: 'Maximum 3 tickets allowed per VATIN' });
    }

    const ticketId = require('uuid').v4();
    const createdAt = new Date();

    await client.query('INSERT INTO tickets (ticket_id, vatin, first_name, last_name, created_at) VALUES ($1, $2, $3, $4, $5)', 
      [ticketId, vatin, firstName, lastName, createdAt]);

    const qrCodeURL = `${process.env.BASE_URL}/ticket/${ticketId}`;
    const qrCodeImage = await QRCode.toDataURL(qrCodeURL);

    res.json({ ticketId, qrCodeImage });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate ticket' });
  }
});

// Route to display tickets
app.get('/tickets', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM tickets');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running');
});
