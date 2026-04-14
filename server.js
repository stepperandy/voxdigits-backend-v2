require("dotenv").config();

const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
const PORT = process.env.PORT || 3000;

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID,
  FRONTEND_URL,
} = process.env;

function requireEnv(name, value) {
  if (!value) {
    console.error(Missing required environment variable: ${name});
    process.exit(1);
  }
}

requireEnv("TWILIO_ACCOUNT_SID", TWILIO_ACCOUNT_SID);
requireEnv("TWILIO_API_KEY", TWILIO_API_KEY);
requireEnv("TWILIO_API_SECRET", TWILIO_API_SECRET);
requireEnv("TWIML_APP_SID", TWIML_APP_SID);
requireEnv("TWILIO_CALLER_ID", TWILIO_CALLER_ID);

app.use(
  cors({
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "VoxDigits backend is running",
  });
});

app.get("/generateToken", (req, res) => {
  try {
    const identity = req.query.identity || "voxdigits_user";

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    res.json({
      ok: true,
      identity,
      token: token.toJwt(),
    });
  } catch (error) {
    console.error("Token error:", error);
    res.status(500).json({
      ok: false,
      error: "Token generation failed",
    });
  }
});

app.post("/voice", (req, res) => {
  try {
    const to = req.body.To || req.body.to;
    const twiml = new twilio.twiml.VoiceResponse();

    if (!to) {
      twiml.say("No number provided");
      return res.type("text/xml").send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId: TWILIO_CALLER_ID,
      answerOnBridge: true,
    });

    dial.number(to);

    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Voice error:", error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Application error");
    res.type("text/xml").send(twiml.toString());
  }
});

app.post("/incoming", (req, res) => {
  try {
    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial();
    dial.client("voxdigits_user");
    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Incoming error:", error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Cannot connect call");
    res.type("text/xml").send(twiml.toString());
  }
});

app.post("/status", (req, res) => {
  console.log("Call status:", req.body);
  res.sendStatus(200);
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(VoxDigits backend running on port ${PORT});
});
