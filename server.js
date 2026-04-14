const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "VERSION 999 LIVE"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(VERSION 999 LIVE on port ${PORT});
});
