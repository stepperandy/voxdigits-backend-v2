const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.send("VOXDIGITS RENDER BACKEND OK");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/generateToken", (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWIML_APP_SID;
    const identity = process.env.TWILIO_CLIENT_IDENTITY || "voxdigits_user";

    if (!accountSid) return res.status(500).json({ error: "Missing TWILIO_ACCOUNT_SID" });
    if (!apiKey) return res.status(500).json({ error: "Missing TWILIO_API_KEY" });
    if (!apiSecret) return res.status(500).json({ error: "Missing TWILIO_API_SECRET" });
    if (!appSid) return res.status(500).json({ error: "Missing TWIML_APP_SID" });

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    return res.json({
      ok: true,
      identity,
      token: token.toJwt()
    });
  } catch (err) {
    console.error("TOKEN ERROR:", err);
    return res.status(500).json({ error: err.message || "Token generation failed" });
  }
});

app.post("/voice", (req, res) => {
  try {
    console.log("VOICE ROUTE HIT");
    console.log("BODY:", req.body);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const to = req.body.To || req.body.to || req.query.To || req.query.to;
    const callerId = process.env.TWILIO_CALLER_ID;

    console.log("TO:", to);
    console.log("CALLER ID:", callerId);

    if (!callerId) {
      twiml.say("Caller ID missing.");
      return res.type("text/xml").send(twiml.toString());
    }

    if (!to) {
      twiml.say("No destination number.");
      return res.type("text/xml").send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId,
      answerOnBridge: true,
      timeout: 30
    });

    dial.number(String(to).trim());

    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("VOICE ERROR:", err);
    return res.status(500).type("text/plain").send("Voice route failed");
  }
});

app.post("/incoming", (req, res) => {
  try {
    console.log("INCOMING ROUTE HIT");

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const identity = process.env.TWILIO_CLIENT_IDENTITY || "voxdigits_user";

    const dial = twiml.dial({
      answerOnBridge: true,
      timeout: 25
    });

    dial.client(identity);

    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("INCOMING ERROR:", err);
    return res.status(500).type("text/plain").send("Incoming route failed");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
