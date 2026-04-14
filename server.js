const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", function (req, res) {
  res.status(200).json({
    ok: true,
    message: "VERSION 1000 LIVE"
  });
});

app.listen(PORT, "0.0.0.0", function () {
  console.log("VERSION 1000 LIVE on port " + PORT);
});
