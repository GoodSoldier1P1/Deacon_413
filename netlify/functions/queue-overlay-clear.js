// netlify/functions/queue-overlay-clear.js
//
// Sweeps out every entry currently marked "prayed" in one call, so a
// streamer with a large queue isn't stuck deleting them one at a time.

const { fbGet, fbPatch } = require("./lib/firebase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST." };
  }

  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key) return { statusCode: 401, body: "Missing key." };

  const broadcasterId = await fbGet(`overlayKeys/${key}`).catch(() => null);
  if (!broadcasterId) return { statusCode: 401, body: "Invalid key." };

  const queue = await fbGet(`channels/${broadcasterId}/prayerQueue`).catch(() => null);
  if (queue) {
    // A single multi-location PATCH where each value is null deletes each
    // of those children in one request, rather than one call per entry.
    const patch = {};
    for (const [entryKey, entry] of Object.entries(queue)) {
      if (entry.prayed) patch[entryKey] = null;
    }
    if (Object.keys(patch).length > 0) {
      await fbPatch(`channels/${broadcasterId}/prayerQueue`, patch);
    }
  }

  return { statusCode: 200, body: "ok" };
};
