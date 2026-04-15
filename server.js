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

// Keep BOTH routes so the dialer works whether it calls /generateToken or /api/twilio/token
function buildTokenResponse(req, res) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const appSid = process.env.TWIML_APP_SID;

    if (!accountSid) {
      return res.status(500).json({ error: "Missing TWILIO_ACCOUNT_SID" });
    }
    if (!apiKey) {
      return res.status(500).json({ error: "Missing TWILIO_API_KEY" });
    }
    if (!apiSecret) {
      return res.status(500).json({ error: "Missing TWILIO_API_SECRET" });
    }
    if (!appSid) {
      return res.status(500).json({ error: "Missing TWIML_APP_SID" });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity =
      req.query.identity ||
      req.query.user ||
      "voxdigits_user";

    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    return res.json({
      identity,
      token: token.toJwt(),
    });
  } catch (err) {
    console.error("TOKEN ERROR:", err);
    return res.status(500).json({
      error: err.message || "Token generation failed",
    });
  }
}

app.get("/generateToken", buildTokenResponse);
app.get("/api/twilio/token", buildTokenResponse);

app.post("/api/twilio/voice", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const to = req.body.To || req.body.to;
    const callerId = process.env.TWILIO_CALLER_ID;

    if (!callerId) {
      response.say("Caller ID is not configured.");
      return res.type("text/xml").send(response.toString());
    }

    if (to) {
      const dial = response.dial({ callerId });
      dial.number(to);
    } else {
      response.say("Welcome to VoxDigits. Your system is working.");
    }

    return res.type("text/xml").send(response.toString());
  } catch (err) {
    console.error("VOICE ERROR:", err);
    return res.status(500).type("text/plain").send("Voice route failed");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
