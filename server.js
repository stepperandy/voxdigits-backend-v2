const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.json());

// Optional: allow your Replit frontend origin for CORS (replace with your origin)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://your-replit-app.repl.co');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_NUMBER env vars');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Initiate outbound PSTN call
app.post('/call-out', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Missing "to" in request body. Use E.164 format, e.g. +14155551212' });
  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      // Public HTTPS TwiML handler that Twilio will request to get call instructions
      url: ${process.env.PUBLIC_URL || 'https://api.voxdigits.com'}/twilio/voice-handler?connectTo=${encodeURIComponent(to)}
    });
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Twilio call create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Twilio will request this when the outbound leg is answered.
// Return TwiML instructing Twilio to dial the destination (or modify as needed).
app.post('/twilio/voice-handler', (req, res) => {
  const connectTo = req.query.connectTo || req.body.To || '';
  res.type('text/xml');
  // If you prefer to play audio or connect to a conference, change this TwiML.
  res.send(<Response><Dial callerId="${TWILIO_NUMBER}">${connectTo}</Dial></Response>);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(Server listening on port ${port});
});
