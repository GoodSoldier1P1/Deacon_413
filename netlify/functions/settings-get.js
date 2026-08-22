// netlify/functions/settings-get.js

const crypto = require("crypto");
const { fbGet, fbSet, fbPatch } = require("./lib/firebase");

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 401, body: "Missing token." };

  const session = await fbGet(`sessions/${token}`).catch(() => null);
  if (!session) return { statusCode: 401, body: "Invalid or expired session." };

  const settings = await fbGet(`channels/${session.broadcasterId}`).catch(() => null);
  if (!settings) return { statusCode: 404, body: "Channel not found." };

  // Channels installed before the queue overlay existed won't have a key yet
  // — generate one on first dashboard visit instead of requiring a reinstall.
  if (!settings.overlayKey) {
    const overlayKey = crypto.randomBytes(20).toString("hex");
    await fbPatch(`channels/${session.broadcasterId}`, { overlayKey });
    await fbSet(`overlayKeys/${overlayKey}`, session.broadcasterId);
    settings.overlayKey = overlayKey;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  };
};
