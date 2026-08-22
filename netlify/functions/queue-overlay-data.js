// netlify/functions/queue-overlay-data.js
//
// This is what queue-overlay.html polls. Auth here is intentionally
// different from the dashboard: OBS Browser Sources can't do an interactive
// login, so instead of a session token this uses a long-lived, private
// "overlayKey" that lives in the URL you paste into OBS once.

const { fbGet } = require("./lib/firebase");

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 401, body: "Missing key." };

  const broadcasterId = await fbGet(`overlayKeys/${key}`).catch(() => null);
  if (!broadcasterId) return { statusCode: 401, body: "Invalid key." };

  const queue = await fbGet(`channels/${broadcasterId}/prayerQueue`).catch(() => null);
  const entries = queue
    ? Object.entries(queue)
        .map(([entryKey, v]) => ({ entryKey, ...v }))
        .sort((a, b) => a.at - b.at) // oldest first
    : [];

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(entries),
  };
};
