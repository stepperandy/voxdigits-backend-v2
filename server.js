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
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      { identity: process.env.TWILIO_CLIENT_IDENTITY || "voxdigits_user" }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWIML_APP_SID,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    res.json({
      token: token.toJwt(),
      identity: process.env.TWILIO_CLIENT_IDENTITY || "voxdigits_user",
    });
  } catch (err) {
    console.error("TOKEN ERROR:", err);
    res.status(500).json({ error: "Token generation failed" });
  }
});

// OUTBOUND: app -> real phone
app.post("/voice", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const to = req.body.To;
    const callerId = process.env.TWILIO_CALLER_ID;

    if (!callerId) {
      twiml.say("Caller ID is not configured");
      return res.type("text/xml").send(twiml.toString());
    }

    if (!to) {
      twiml.say("No destination number provided");
      return res.type("text/xml").send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId,
      answerOnBridge: true,
    });

    dial.number(to);

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (err) {
    console.error("VOICE ERROR:", err);
    res.status(500).send("Voice route failed");
  }
});

// INBOUND: Twilio number -> app client
app.post("/incoming", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const dial = twiml.dial({
      answerOnBridge: true,
    });

    dial.client(process.env.TWILIO_CLIENT_IDENTITY || "voxdigits_user");

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (err) {
    console.error("INCOMING ERROR:", err);
    res.status(500).send("Incoming route failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
