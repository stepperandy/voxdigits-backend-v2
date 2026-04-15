const express = require("express");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");
const twilio = require("twilio");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const AIRALO_BASE_URL = "https://partners-api.airalo.com";

// Twilio env
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID,

  // Airalo env
  AIRALO_CLIENT_ID,
  AIRALO_CLIENT_SECRET
} = process.env;

function hasTwilioEnv() {
  return Boolean(
    TWILIO_ACCOUNT_SID &&
      TWILIO_API_KEY &&
      TWILIO_API_SECRET &&
      TWIML_APP_SID &&
      TWILIO_CALLER_ID
  );
}

async function getAiraloToken() {
  if (!AIRALO_CLIENT_ID || !AIRALO_CLIENT_SECRET) {
    throw new Error("Missing AIRALO_CLIENT_ID or AIRALO_CLIENT_SECRET");
  }

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
      },
      timeout: 30000
    }
  );

  const token = response?.data?.data?.access_token;
  if (!token) {
    throw new Error("Airalo token missing in response");
  }

  return token;
}

// Health
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "VoxDigits backend is live"
  });
});

// Twilio token
app.get("/generateToken", (req, res) => {
  try {
    if (!hasTwilioEnv()) {
      return res.status(500).json({
        ok: false,
        error: "Missing Twilio environment variables"
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

    res.json({
      ok: true,
      identity,
      token: token.toJwt()
    });
  } catch (err) {
    console.error("generateToken error:", err.message);
    res.status(500).json({
      ok: false,
      error: "Token generation failed",
      details: err.message
    });
  }
});

// Twilio voice webhook
app.post("/voice", (req, res) => {
  try {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

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
    res.send(twiml.toString());
  } catch (err) {
    console.error("voice error:", err.message);
    res.status(500).send("Voice route error");
  }
});

// Airalo auth test
app.get("/airalo/token-test", async (req, res) => {
  try {
    const token = await getAiraloToken();
    res.json({
      ok: true,
      token_preview: ${token.slice(0, 20)}...
    });
  } catch (err) {
    console.error("airalo token-test error:", err.response?.data || err.message);
    res.status(500).json({
      ok: false,
      error: "Airalo auth failed",
      details: err.response?.data || err.message
    });
  }
});

// Airalo packages
app.get("/airalo/packages", async (req, res) => {
  try {
    const token = await getAiraloToken();

    const response = await axios.get(${AIRALO_BASE_URL}/v2/packages, {
      headers: {
        Accept: "application/json",
        Authorization: Bearer ${token}
      },
      params: {
        country: req.query.country,
        type: req.query.type,
        limit: req.query.limit || 50
      },
      timeout: 30000
    });

    res.json({
      ok: true,
      data: response.data
    });
  } catch (err) {
    console.error("airalo packages error:", err.response?.data || err.message);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch packages",
      details: err.response?.data || err.message
    });
  }
});

// Airalo order
app.post("/airalo/order", async (req, res) => {
  try {
    const {
      package_id,
      quantity = 1,
      type = "sim",
      description = "",
      brand_settings_name,
      to_email
    } = req.body;

    if (!package_id) {
      return res.status(400).json({
        ok: false,
        error: "package_id is required"
      });
    }

    const token = await getAiraloToken();

    const form = new FormData();
    form.append("quantity", String(quantity));
    form.append("package_id", package_id);
    form.append("type", type);

    if (description) form.append("description", description);
    if (brand_settings_name) form.append("brand_settings_name", brand_settings_name);
    if (to_email) form.append("to_email", to_email);

    const response = await axios.post(${AIRALO_BASE_URL}/v2/orders, form, {
      headers: {
        Accept: "application/json",
        Authorization: Bearer ${token},
        ...form.getHeaders()
      },
      timeout: 30000
    });

    res.json({
      ok: true,
      data: response.data
    });
  } catch (err) {
    console.error("airalo order error:", err.response?.data || err.message);
    res.status(500).json({
      ok: false,
      error: "Failed to submit order",
      details: err.response?.data || err.message
    });
  }
});

// Airalo install instructions
app.get("/airalo/instructions/:iccid", async (req, res) => {
  try {
    const token = await getAiraloToken();
    const language = req.query.lang || "en";

    const response = await axios.get(
      ${AIRALO_BASE_URL}/v2/sims/${encodeURIComponent(req.params.iccid)}/instructions,
      {
        headers: {
          Accept: "application/json",
          Authorization: Bearer ${token},
          "Accept-Language": language
        },
        timeout: 30000
      }
    );

    res.json({
      ok: true,
      data: response.data
    });
  } catch (err) {
    console.error("airalo instructions error:", err.response?.data || err.message);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch instructions",
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
