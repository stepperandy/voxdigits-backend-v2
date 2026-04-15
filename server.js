const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID
} = process.env;

function missingTwilioVars() {
  const missing = [];
  if (!TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!TWILIO_API_KEY) missing.push("TWILIO_API_KEY");
  if (!TWILIO_API_SECRET) missing.push("TWILIO_API_SECRET");
  if (!TWIML_APP_SID) missing.push("TWIML_APP_SID");
  if (!TWILIO_CALLER_ID) missing.push("TWILIO_CALLER_ID");
  return missing;
}

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "VoxDigits Twilio backend is live"
  });
});

app.get("/generateToken", (req, res) => {
  try {
    const missing = missingTwilioVars();
    if (missing.length) {
      return res.status(500).json({
        ok: false,
        error: "Missing environment variables",
        missing
      });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = req.query.identity || user_${Date.now()};

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

    return res.json({
      ok: true,
      identity,
      token: token.toJwt()
    });
  } catch (error) {
    console.error("generateToken error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/voice", (req, res) => {
  try {
    const twiml = new twilio.twiml.VoiceResponse();
    const to = req.body.To || req.query.To;

    if (!to) {
      twiml.say("No destination number was provided.");
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    const dial = twiml.dial({
      callerId: TWILIO_CALLER_ID
    });

    dial.number(to);

    res.type("text/xml");
    return res.send(twiml.toString());
  } catch (error) {
    console.error("voice error:", error);
    return res.status(500).send("Voice route error");
  }
});

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
