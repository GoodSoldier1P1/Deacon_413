// netlify/functions/queue-overlay-toggle.js
//
// Flips a single entry's "prayed" flag. Clicking again un-checks it — handy
// for misclicks, and cheap enough that a streamer with a big queue can just
// tap through items as they get to them without any per-item confirmation.

const { fbGet, fbPatch } = require("./lib/firebase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST." };
  }

  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 401, body: "Missing key." };

  const broadcasterId = await fbGet(`overlayKeys/${key}`).catch(() => null);
  if (!broadcasterId) return { statusCode: 401, body: "Invalid key." };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON." };
  }
  if (!body.entryKey) return { statusCode: 400, body: "Missing entryKey." };

  await fbPatch(`channels/${broadcasterId}/prayerQueue/${body.entryKey}`, {
    prayed: !!body.prayed,
  });

  return { statusCode: 200, body: "ok" };
};
