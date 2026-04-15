const express = require("express");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");
const twilio = require("twilio");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// -----------------------------
// ENV
// -----------------------------
const {
  // Twilio
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWIML_APP_SID,
  TWILIO_CALLER_ID,

  // Airalo
  AIRALO_CLIENT_ID,
  AIRALO_CLIENT_SECRET
} = process.env;

const AIRALO_BASE_URL = "https://partners-api.airalo.com";

// -----------------------------
// HELPERS
// -----------------------------
async function getAiraloAccessToken() {
  if (!AIRALO_CLIENT_ID || !AIRALO_CLIENT_SECRET) {
    throw new Error("Missing AIRALO_CLIENT_ID or AIRALO_CLIENT_SECRET");
  }

  const body = new URLSearchParams();
  body.append("client_id", AIRALO_CLIENT_ID);
  body.append("client_secret", AIRALO_CLIENT_SECRET);
  body.append("grant_type", "client_credentials");

  const response = await axios.post(${AIRALO_BASE_URL}/v2/token, body.toString(), {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  const accessToken = response?.data?.data?.access_token;
  if (!accessToken) {
    throw new Error("Airalo token response missing access_token");
  }

  return accessToken;
}

function ensureTwilioEnv() {
  return Boolean(
    TWILIO_ACCOUNT_SID &&
    TWILIO_API_KEY &&
    TWILIO_API_SECRET &&
    TWIML_APP_SID &&
    TWILIO_CALLER_ID
  );
}

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "VoxDigits backend is live"
  });
});

// -----------------------------
// TWILIO ROUTES
// -----------------------------
app.get("/generateToken", (req, res) => {
  try {
    if (!ensureTwilioEnv()) {
      return res.status(500).json({
        ok: false,
        error: "Missing one or more Twilio environment variables"
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
    console.error("Twilio token error:", error.message);
    return res.status(500).json({
      ok: false,
      error: "Token generation failed",
      details: error.message
    });
  }
});

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
    return res.send(twiml.toString());
  } catch (error) {
    console.error("Twilio voice error:", error.message);
    return res.status(500).send("Voice route error");
  }
});

// -----------------------------
// AIRALO ROUTES
// -----------------------------

// 1) Test Airalo auth
app.get("/airalo/token-test", async (req, res) => {
  try {
    const token = await getAiraloAccessToken();
    return res.json({
      ok: true,
      message: "Airalo token acquired successfully",
      token_preview: ${token.slice(0, 20)}...
    });
  } catch (error) {
    console.error("Airalo token test error:", error.response?.data || error.message);
    return res.status(500).json({
      ok: false,
      error: "Airalo auth failed",
      details: error.response?.data || error.message
    });
  }
});

// 2) Get packages
app.get("/airalo/packages", async (req, res) => {
  try {
    const token = await getAiraloAccessToken();

    const response = await axios.get(${AIRALO_BASE_URL}/v2/packages, {
      headers: {
        Accept: "application/json",
        Authorization: Bearer ${token}
      },
      params: {
        country: req.query.country,
        type: req.query.type,
        limit: req.query.limit || 100
      }
    });

    return res.json({
      ok: true,
      data: response.data
    });
  } catch (error) {
    console.error("Airalo packages error:", error.response?.data || error.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to fetch Airalo packages",
      details: error.response?.data || error.message
    });
  }
});

// 3) Submit order
app.post("/airalo/order", async (req, res) => {
  try {
    const { package_id, quantity = 1, type = "sim", description = "", brand_settings_name, to_email } = req.body;

    if (!package_id) {
      return res.status(400).json({
        ok: false,
        error: "package_id is required"
      });
    }

    const token = await getAiraloAccessToken();

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
      }
    });

    return res.json({
      ok: true,
      data: response.data
    });
  } catch (error) {
    console.error("Airalo order error:", error.response?.data || error.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to submit Airalo order",
      details: error.response?.data || error.message
    });
  }
});

// 4) Get installation instructions
app.get("/airalo/instructions/:iccid", async (req, res) => {
  try {
    const { iccid } = req.params;
    const language = req.query.lang || "en";

    const token = await getAiraloAccessToken();

    const response = await axios.get(
      ${AIRALO_BASE_URL}/v2/sims/${encodeURIComponent(iccid)}/instructions,
      {
        headers: {
          Accept: "application/json",
          Authorization: Bearer ${token},
          "Accept-Language": language
        }
      }
    );

    return res.json({
      ok: true,
      data: response.data
    });
  } catch (error) {
    console.error("Airalo instructions error:", error.response?.data || error.message);
    return res.status(500).json({
      ok: false,
      error: "Failed to fetch installation instructions",
      details: error.response?.data || error.message
    });
  }
});

// -----------------------------
// START
// -----------------------------
app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
    
   
