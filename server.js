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

const CLIENT_IDENTITY = "voxdigits_user";

function getMissingEnvVars() {
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
    message: "VoxDigits Twilio backend is live",
    clientIdentity: CLIENT_IDENTITY
  });
});

app.get("/generateToken", (req, res) => {
  try {
    const missing = getMissingEnvVars();
    if (missing.length > 0) {
      return res.status(500).json({
        ok: false,
        error: "Missing environment variables",
        missing
      });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity: CLIENT_IDENTITY }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    return res.json({
      ok: true,
      identity: CLIENT_IDENTITY,
      token: token.toJwt()
    });
  } catch (error) {
    console.error("generateToken error:", error);
    return res.status(500).json({
      ok: false,
      error: "Token generation failed",
      details: error.message
    });
  }
});

app.all("/voice", (req, res) => {
  try {
    const twiml = new twilio.twiml.VoiceResponse();

    const to =
      req.body.To ||
      req.query.To ||
      req.body.to ||
      req.query.to ||
      req.body.number ||
      req.query.number ||
      "";

    console.log("VOICE ROUTE HIT");
    console.log("Method:", req.method);
    console.log("Body:", req.body);
    console.log("Query:", req.query);
    console.log("Resolved To:", to);

    const dial = twiml.dial({
      callerId: TWILIO_CALLER_ID,
      answerOnBridge: true
    });

    if (to && String(to).startsWith("+")) {
      dial.number(to);
    } else {
      dial.client(CLIENT_IDENTITY);
    }

    res.type("text/xml");
    return res.send(twiml.toString());
  } catch (error) {
    console.error("voice route error:", error);
    return res.status(500).send("Voice route error");
  }
});

app.all("/status", (req, res) => {
  console.log("STATUS CALLBACK:", {
    method: req.method,
    body: req.body,
    query: req.query
  });

  if (req.method === "GET") {
    return res.status(200).send("Status endpoint is live");
  }

  return res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
