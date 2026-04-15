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
  res.send("VoxDigits Twilio backend is live");
});

app.get("/generateToken", (req, res) => {
  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity: user_${Date.now()} }
    );

    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true
    }));

    res.json({ ok: true, token: token.toJwt() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/voice", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    const to = req.body.To || req.query.To;

    if (!to) {
      twiml.say("No destination number was provided.");
    } else {
      const dial = twiml.dial({ callerId: TWILIO_CALLER_ID });
      dial.number(to);
    }

    res.type("text/xml").send(twiml.toString());
  } catch (err) {
    res.status(500).send("Voice route error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
