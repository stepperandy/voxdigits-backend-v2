const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root check
app.get("/", (req, res) => {
  res.send("VOXDIGITS RENDER BACKEND OK");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 🔑 TOKEN ROUTE
app.get("/generateToken", (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWIML_APP_SID;

    const identity = "voxdigits_user";

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      return res.status(500).json({ error: "Missing Twilio env variables" });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Token generation failed" });
  }
});

// 📞 OUTBOUND CALL
app.post("/api/twilio/voice", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const to = req.body.To;
  const callerId = process.env.TWILIO_CALLER_ID;

  if (!to || !callerId) {
    twiml.say("Call cannot be completed");
    return res.type("text/xml").send(twiml.toString());
  }

  const dial = twiml.dial({
    callerId: callerId,
    answerOnBridge: true
  });

  dial.number(to);

  res.type("text/xml");
  res.send(twiml.toString());
});

// 📥 INBOUND CALL
app.post("/api/twilio/incoming", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const dial = twiml.dial({
    answerOnBridge: true
  });

  dial.client("voxdigits_user");

  res.type("text/xml");
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
