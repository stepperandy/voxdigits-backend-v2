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

// ---------- Basic checks ----------
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

// ---------- Middleware ----------
const corsOptions = {
  origin: FRONTEND_URL === "*" ? true : [FRONTEND_URL],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------- Health check ----------
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "VoxDigits backend is running",
  });
});

// ---------- Token generator ----------
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
    console.error("Token generation error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to generate token",
      details: error.message,
    });
  }
});

// ---------- Outbound calling webhook ----------
// Twilio TwiML App Voice URL should point here: /voice
app.post("/voice", (req, res) => {
  try {
    console.log("Outbound /voice hit");
    console.log("Request body:", req.body);

    const to = req.body.To || req.body.to;
    const twiml = new twilio.twiml.VoiceResponse();

    if (!to) {
      twiml.say("No destination number was provided.");
      return res.type("text/xml").send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId: TWILIO_CALLER_ID,
      answerOnBridge: true,
      timeout: 30,
    });

    dial.number(
      {
        statusCallback: "/status",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
      },
      String(to).trim()
    );

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Voice webhook error:", error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Application error. Please try again later.");
    return res.type("text/xml").send(twiml.toString());
  }
});

// ---------- Inbound calling webhook ----------
// Twilio phone number Voice webhook should point here: /incoming
app.post("/incoming", (req, res) => {
  try {
    console.log("Inbound /incoming hit");
    console.log("Request body:", req.body);

    const twiml = new twilio.twiml.VoiceResponse();

    const dial = twiml.dial({
      answerOnBridge: true,
      timeout: 20,
    });

    // This must match the identity used when generating token
    dial.client("voxdigits_user");

    return res.type("text/xml").send(twiml.toString());
  } catch (error) {
    console.error("Incoming webhook error:", error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Unable to connect your call right now.");
    return res.type("text/xml").send(twiml.toString());
  }
});

// ---------- Call status callback ----------
app.post("/status", (req, res) => {
  console.log("Call status:", req.body);
  return res.sendStatus(200);
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found",
  });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});

// ---------- Start server ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(VoxDigits backend running on port ${PORT});
});