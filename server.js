const express = require("express");
const twilio = require("twilio");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWIML_APP_SID;
const CALLER_ID = process.env.TWILIO_CALLER_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

app.use(cors({
  origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", function (req, res) {
  res.status(200).json({
    ok: true,
    message: "VoxDigits backend live"
  });
});

app.get("/health", function (req, res) {
  res.status(200).send("ok");
});

app.get("/generateToken", function (req, res) {
  try {
    if (!ACCOUNT_SID || !API_KEY || !API_SECRET || !TWIML_APP_SID) {
      return res.status(500).json({
        ok: false,
        error: "Missing Twilio environment variables"
      });
    }

    const identity = req.query.identity || "voxdigits_user";

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      ACCOUNT_SID,
      API_KEY,
      API_SECRET,
      { identity: identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.status(200).json({
      ok: true,
      identity: identity,
      token: token.toJwt()
    });
  } catch (err) {
    console.error("generateToken error:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to generate token"
    });
  }
});

app.post("/voice", function (req, res) {
  try {
    const to = req.body.To || req.body.to;
    const twiml = new twilio.twiml.VoiceResponse();

    if (!to) {
      twiml.say("No destination number provided.");
      return res.type("text/xml").send(twiml.toString());
    }

    if (!CALLER_ID) {
      twiml.say("Caller ID is not configured.");
      return res.type("text/xml").send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId: CALLER_ID,
      answerOnBridge: true
    });

    dial.number(String(to).trim());

    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("voice error:", err);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Application error.");
    return res.type("text/xml").send(twiml.toString());
  }
});

app.post("/incoming", function (req, res) {
  try {
    const twiml = new twilio.twiml.VoiceResponse();
    const dial = twiml.dial();
    dial.client("voxdigits_user");
    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("incoming error:", err);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Cannot connect call.");
    return res.type("text/xml").send(twiml.toString());
  }
});

app.listen(PORT, "0.0.0.0", function () {
  console.log("VoxDigits backend live on port " + PORT);
});
