const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS: allow your Replit origin or '' for quick debugging
const REPLIT_ORIGIN = process.env.REPLIT_ORIGIN || '';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', REPLIT_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Required env vars
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NUMBER,
  PUBLIC_URL,
  VERIFY_TWILIO = 'false' // set 'true' after debugging
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_NUMBER) {
  console.error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_NUMBER');
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Health
app.get('/', (req, res) => res.send('VOXDIGITS RENDER BACKEND OK'));
app.get('/health', (req, res) => res.json({ ok: true }));

// Helper to validate Twilio signature (optional)
function isValidTwilio(req) {
  if (VERIFY_TWILIO === 'false') return true;
  try {
    const signature = req.headers['x-twilio-signature'] || '';
    const url = (PUBLIC_URL || ${req.protocol}://${req.get('host')}) + req.originalUrl.split('?')[0];
    return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);
  } catch (e) {
    console.error('Twilio validation exception', e);
    return false;
  }
}

// TwiML handler for outbound calls
app.all('/twilio/voice-handler', (req, res) => {
  console.log('VOICE HANDLER hit', { method: req.method, query: req.query, body: req.body });
  if (!isValidTwilio(req)) {
    console.warn('Invalid Twilio signature on voice-handler (or verification disabled)');
    // continue for debugging if VERIFY_TWILIO=false
  }
  const connectTo = req.query.connectTo || req.body.To || '';
  const twiml = new twilio.twiml.VoiceResponse();
  if (!connectTo) {
    twiml.say('No destination provided. Goodbye.');
  } else {
    const dial = twiml.dial({ callerId: TWILIO_NUMBER });
    dial.number(connectTo);
  }
  res.type('text/xml').send(twiml.toString());
});

// Inbound webhook for your Twilio number (configure this in Twilio Console)
app.post('/twilio/incoming', (req, res) => {
  console.log('INCOMING webhook', req.body);
  if (!isValidTwilio(req)) {
    console.warn('Invalid Twilio signature on incoming');
  }
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Thanks for calling VoxDigits. Goodbye.');
  res.type('text/xml').send(twiml.toString());
});

// Create outbound call (production)
app.post('/call-out', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Missing "to" in body. Use E.164 format.' });
  const host = (PUBLIC_URL || https://${req.get('host')}).replace(//$/, '');
  const twimlUrl = ${host}/twilio/voice-handler?connectTo=${encodeURIComponent(to)};
  console.log('Creating call', { to, from: TWILIO_NUMBER, twimlUrl });
  try {
    const call = await client.calls.create({ to, from: TWILIO_NUMBER, url: twimlUrl, timeout: 30 });
    console.log('Call created', call.sid);
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Call create error', err);
    return res.status(500).json({ errorName: err.name, errorCode: err.code || null, message: err.message });
  }
});

// Test-call: returns full Twilio error info for debugging
app.post('/test-call', async (req, res) => {
  const to = req.body && req.body.to;
  if (!to) return res.status(400).json({ error: 'Provide JSON body { "to": "+1..." }' });
  const host = (PUBLIC_URL || https://${req.get('host')}).replace(//$/, '');
  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      url: ${host}/twilio/voice-handler?connectTo=${encodeURIComponent(to)},
      timeout: 20
    });
    console.log('Test call created', call.sid);
    return res.json({ sid: call.sid, status: call.status });
  } catch (err) {
    console.error('Test-call error', JSON.stringify(err, Object.getOwnPropertyNames(err)));
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
app.listen(port, () => console.log(Server listening on ${port}));
