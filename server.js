const express = require("express");
const cors = require("cors");
const axios = require("axios");
const twilio = require("twilio");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const AIRALO_BASE_URL = "https://partners-api.airalo.com";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID,
  AIRALO_CLIENT_ID,
  AIRALO_CLIENT_SECRET
} = process.env;

app.get("/", (req, res) => {
  res.json({ ok: true, message: "VoxDigits backend is live" });
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

app.get("/airalo/token-test", async (req, res) => {
  try {
    const body = new URLSearchParams();
    body.append("client_id", AIRALO_CLIENT_ID);
    body.append("client_secret", AIRALO_CLIENT_SECRET);
    body.append("grant_type", "client_credentials");

    const response = await axios.post(
      ${AIRALO_BASE_URL}/v2/token,
      body.toString(),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    res.json({ ok: true, data: response.data });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
