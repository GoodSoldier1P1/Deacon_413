// netlify/functions/eventsub-webhook.js
//
// This is the single endpoint Twitch calls for every subscribed event
// across every installed channel. It:
//   1. Verifies the request really came from Twitch (HMAC signature).
//   2. Answers the one-time "challenge" Twitch sends when a subscription
//      is first created.
//   3. On an actual chat message, checks it against that channel's
//      configured commands and replies if one matches.

const crypto = require("crypto");
const { fbGet, fbPatch } = require("./lib/firebase");
const { sendChatMessage } = require("./lib/twitch");

const MESSAGE_TYPE_VERIFICATION = "webhook_callback_verification";
const MESSAGE_TYPE_NOTIFICATION = "notification";
const MESSAGE_TYPE_REVOCATION = "revocation";

function verifySignature(headers, rawBody) {
  const id = headers["twitch-eventsub-message-id"];
  const timestamp = headers["twitch-eventsub-message-timestamp"];
  const signature = headers["twitch-eventsub-message-signature"];
  if (!id || !timestamp || !signature) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.TWITCH_EVENTSUB_SECRET)
      .update(id + timestamp + rawBody)
      .digest("hex");

  // Constant-time comparison
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleChatMessage(evt) {
  const broadcasterId = evt.broadcaster_user_id;
  const text = (evt.message && evt.message.text || "").trim();
  if (!text.startsWith("!")) return; // quick bail for non-commands

  const settings = await fbGet(`channels/${broadcasterId}`).catch(() => null);
  if (!settings) return;

  const [cmd, ...rest] = text.split(/\s+/);
  const cmdLower = cmd.toLowerCase();

  if (settings.donationEnabled && cmdLower === (settings.donationCommand || "!give").toLowerCase()) {
    const link = settings.donationLink || "(no donation link set yet)";
    const message = settings.donationMessage || "💛 Support the stream:";
    await sendChatMessage(broadcasterId, `${message} ${link}`);
    return;
  }

  if (settings.prayerEnabled && cmdLower === (settings.prayerCommand || "!prayer").toLowerCase()) {
    const requestText = rest.join(" ").trim();
    if (!requestText) {
      await sendChatMessage(broadcasterId, `🙏 Add your request after the command, e.g. "${cmd} for my grandmother's surgery".`);
      return;
    }
    const entryKey = `queue_${Date.now()}`;
    await fbPatch(`channels/${broadcasterId}/prayerQueue`, {
      [entryKey]: {
        from: evt.chatter_user_login,
        text: requestText,
        at: Date.now(),
      },
    });
    await sendChatMessage(broadcasterId, `🙏 Got it, ${evt.chatter_user_name} — added to the prayer queue.`);
    return;
  }
}

exports.handler = async (event) => {
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;

  const rawBody = event.body || "";

  if (!verifySignature(headers, rawBody)) {
    return { statusCode: 403, body: "Signature verification failed." };
  }

  const messageType = headers["twitch-eventsub-message-type"];
  const payload = JSON.parse(rawBody);

  if (messageType === MESSAGE_TYPE_VERIFICATION) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/plain" },
      body: payload.challenge,
    };
  }

  if (messageType === MESSAGE_TYPE_REVOCATION) {
    console.warn("EventSub subscription revoked:", payload.subscription);
    return { statusCode: 200, body: "ok" };
  }

  if (messageType === MESSAGE_TYPE_NOTIFICATION) {
    if (payload.subscription.type === "channel.chat.message") {
      try {
        await handleChatMessage(payload.event);
      } catch (err) {
        // Log and still 200 — Twitch will retry on non-2xx, and we don't
        // want a transient error turning into a retry storm.
        console.error("Error handling chat message:", err);
      }
    }
    return { statusCode: 200, body: "ok" };
  }

  return { statusCode: 200, body: "ok" };
};