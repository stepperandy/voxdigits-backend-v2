const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID
} = process.env;

app.get("/", (req, res) => {
  res.send("VoxDigits backend is live");
});

app.get("/generateToken", (req, res) => {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET || !TWIML_APP_SID) {
      return res.status(500).json({ error: "Missing env variables" });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = req.query.identity || "user_" + Date.now();

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt(), identity });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: "Token generation failed" });
  }
});

app.all("/voice", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const to =
      req.body.To ||
      req.query.To ||
      req.body.to ||
      req.query.to ||
      req.body.number ||
      req.query.number;

    console.log("VOICE ROUTE HIT");
    console.log("Method:", req.method);
    console.log("Body:", req.body);
    console.log("Query:", req.query);
    console.log("Resolved To:", to);

    if (!to) {
      twiml.say("No destination number was provided.");
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId: TWILIO_CALLER_ID,
      answerOnBridge: true
    });

    dial.number(to);

    res.type("text/xml");
    return res.send(twiml.toString());
  } catch (err) {
    console.error("Voice error:", err);
    res.status(500).send("Voice error");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
