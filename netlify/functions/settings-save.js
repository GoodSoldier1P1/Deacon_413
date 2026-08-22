// netlify/functions/settings-save.js

const { fbGet, fbPatch } = require("./lib/firebase");

// Only these fields are writable from the dashboard — never let the client
// overwrite things like installedAt or login by sending extra keys.
const ALLOWED_FIELDS = [
  "donationEnabled",
  "donationLink",
  "donationCommand",
  "donationMessage",
  "prayerEnabled",
  "prayerCommand",
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST." };
  }

  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 401, body: "Missing token." };

  const session = await fbGet(`sessions/${token}`).catch(() => null);
  if (!session) return { statusCode: 401, body: "Invalid or expired session." };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON." };
  }

  const patch = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key];
  }

  await fbPatch(`channels/${session.broadcasterId}`, patch);

  return { statusCode: 200, body: "Saved." };
};
