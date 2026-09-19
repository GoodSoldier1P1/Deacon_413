// netlify/functions/queue-overlay-settings-save.js
//
// Called only from the Dock's settings panel (the Source never shows
// controls, since it can be live on stream). Values are clamped
// server-side so a stray request can't push something absurd into
// Firebase that both views would then render.

const { fbGet, fbSet } = require("./lib/firebase");

function clamp(n, min, max) {
  n = Number(n);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

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

  const settings = {
    fontSize: clamp(body.fontSize, 10, 22),
    spacing: clamp(body.spacing, 4, 22),
    scrollSpeedIndex: clamp(body.scrollSpeedIndex, 0, 4),
  };

  await fbSet(`channels/${broadcasterId}/queueDisplaySettings`, settings);

  return { statusCode: 200, body: "ok" };
};
