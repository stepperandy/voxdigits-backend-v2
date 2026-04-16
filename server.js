const express = require('express');
const twilio = require('twilio');

const app = express();

// Parsers: JSON for API, urlencoded for Twilio webhooks
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple CORS (allow your Replit origin or use '' for quick test)
const REPLIT_ORIGIN = process.env.REPLIT_ORIGIN || '';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', REPLIT_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  PUBLIC_URL
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_NUMBER env vars');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Initiate outbound PSTN call
app.post('/call-out', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Missing "to" in request body. Use E.164 format, e.g. +14155551212' });

  const host = PUBLIC_URL || req.get('origin') || https://${req.get('host')};
  const twimlUrl = ${host.replace(/\/$/, '')}/twilio/voice-handler?connectTo=${encodeURIComponent(to)};

  console.log('Creating call', { to, from: TWILIO_NUMBER, twimlUrl });

  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: twimlUrl
    });
    console.log('Twilio call created', call.sid);
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Twilio call create error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Twilio webhook for call instructions
app.post('/twilio/voice-handler', (req, res) => {
  // Log Twilio request for debugging
  console.log('Twilio webhook hit', { body: req.body, query: req.query });

  const connectTo = req.query.connectTo || req.body.To || '';
  res.type('text/xml');

  if (!connectTo) {
    console.warn('No destination; returning empty TwiML');
    return res.send(<Response><Say>Destination not provided.</Say></Response>);
  }

  const twiml = <Response><Dial callerId="${TWILIO_NUMBER}">${connectTo}</Dial></Response>;
  res.send(twiml);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(Server listening on ${port}));
