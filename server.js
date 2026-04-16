const express = require('express');
const twilio = require('twilio');
const crypto = require('crypto');

const app = express();

// --- Raw body middleware for Twilio request validation (must be before body parsers) ---
app.use((req, res, next) => {
  let data = [];
  req.on('data', chunk => data.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(data).toString();
    next();
  });
});

// Parsers: JSON for API, urlencoded for Twilio webhook bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS: set your Replit origin or '' for testing
const REPLIT_ORIGIN = process.env.REPLIT_ORIGIN || '';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', REPLIT_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Required env vars
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  PUBLIC_URL,          // e.g. https://voxdigits-backend-v2.onrender.com
  VERIFY_TWILIO = 'true' // set to 'false' to disable Twilio signature check (not recommended)
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_NUMBER env vars');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Utility: validate Twilio webhook signature
function validateTwilioRequest(req) {
  if (VERIFY_TWILIO === 'false') return true;
  const signature = req.headers['x-twilio-signature'] || '';
  const url = (PUBLIC_URL || ${req.protocol}://${req.get('host')}) + req.originalUrl.split('?')[0];
  // Use twilio helper to validate with raw body
  return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Inbound call webhook (configure this URL in Twilio for your Twilio number's Voice webhook)
app.post('/twilio/incoming', (req, res) => {
  try {
    if (!validateTwilioRequest(req)) {
      console.warn('Invalid Twilio signature for /twilio/incoming');
      return res.status(403).send('Invalid Twilio signature');
    }
  } catch (e) {
    console.error('Twilio validation error:', e);
    return res.status(500).send('Validation error');
  }

  console.log('Incoming call webhook', { from: req.body.From, to: req.body.To, body: req.body });

  // Example behavior: greet and forward to an operator number or to voicemail
  const operatorNumber = process.env.OPERATOR_NUMBER; // optional
  let twiml = new twilio.twiml.VoiceResponse();

  if (operatorNumber) {
    twiml.say('Please wait while we connect your call.');
    twiml.dial({ callerId: TWILIO_NUMBER }, operatorNumber);
  } else {
    twiml.say('Thank you for calling VoxDigits. Please leave a message after the tone.');
    twiml.record({ maxLength: 60, action: '/twilio/recording-complete' });
  }

  res.type('text/xml').send(twiml.toString());
});

// Recording callback
app.post('/twilio/recording-complete', (req, res) => {
  console.log('Recording complete', req.body);
  // You can store RecordingUrl from req.body.RecordingUrl
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Thanks. Goodbye.');
  res.type('text/xml').send(twiml.toString());
});

// Outbound call: frontend calls this to create a PSTN outbound call
app.post('/call-out', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Missing "to" in body. Use E.164 format, e.g. +14155551212' });

  const host = (PUBLIC_URL || https://${req.get('host')}).replace(//$/, '');
  const twimlUrl = ${host}/twilio/voice-handler?connectTo=${encodeURIComponent(to)};

  console.log('Creating outbound call', { to, from: TWILIO_NUMBER, twimlUrl });

  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: twimlUrl,
      timeout: 30
    });
    console.log('Created call SID', call.sid);
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Twilio call create error:', err);
    return res.status(500).json({
      message: 'Twilio create call failed',
      errorName: err.name,
      errorCode: err.code || null,
      errorMessage: err.message
    });
  }
});

// TwiML handler Twilio will request for outbound call instructions
app.post('/twilio/voice-handler', (req, res) => {
  try {
    if (!validateTwilioRequest(req)) {
      console.warn('Invalid Twilio signature for /twilio/voice-handler');
      // Note: Twilio creates outbound call to the REST API; when Twilio requests your TwiML it signs too.
      return res.status(403).send('Invalid Twilio signature');
    }
  } catch (e) {
    console.error('Twilio validation error (voice-handler):', e);
    return res.status(500).send('Validation error');
  }

  console.log('Twilio voice handler', { body: req.body, query: req.query });

  const connectTo = req.query.connectTo || req.body.To || '';
  const twiml = new twilio.twiml.VoiceResponse();

  if (!connectTo) {
    twiml.say('No destination provided. Goodbye.');
  } else {
    // Dial the destination and set callerId to your Twilio number
    const dial = twiml.dial({ callerId: TWILIO_NUMBER });
    dial.number(connectTo);
  }

  res.type('text/xml').send(twiml.toString());
});

// Temporary test-call that returns Twilio error info if creation fails
app.post('/test-call', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Provide JSON body { "to": "+1..." }' });
  try {
    const host = (PUBLIC_URL || https://${req.get('host')}).replace(//$/, '');
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: ${host}/twilio/voice-handler?connectTo=${encodeURIComponent(to)},
      timeout: 20
    });
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Test-call create error', err);
    return res.status(500).json({
      message: 'Twilio create call failed',
      errorName: err.name,
      errorCode: err.code || null,
      errorMessage: err.message,
      more: err.more || null
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(Server listening on ${port}))
