// netlify/functions/lib/twitch.js
//
// Required env vars:
//   TWITCH_CLIENT_ID
//   TWITCH_CLIENT_SECRET
//   TWITCH_EVENTSUB_SECRET   (any random string you invent, used to verify
//                             that webhook notifications really came from Twitch)
//   PUBLIC_BASE_URL          (e.g. https://deacongg.netlify.app)

const { fbGet, fbSet } = require("./firebase");

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// ---------------------------------------------------------------------
// App access token (client-credentials grant) — used to create EventSub
// subscriptions. Cached in Firebase so we're not re-fetching on every call.
// ---------------------------------------------------------------------
async function getAppAccessToken() {
  const cached = await fbGet("twitch/appToken").catch(() => null);
  if (cached && cached.expires_at > Date.now() + 60_000) {
    return cached.access_token;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`App token request failed: ${res.status}`);
  const data = await res.json();

  await fbSet("twitch/appToken", {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

// ---------------------------------------------------------------------
// Bot's own user token — authorized once by the Deacon_413 bot account
// itself (see auth-bot-start.js / auth-bot-callback.js), refreshed as
// needed. This is the identity messages are actually sent as.
// ---------------------------------------------------------------------
async function getBotAccessToken() {
  const stored = await fbGet("twitch/botToken");
  if (!stored) {
    throw new Error("Bot has not been authorized yet — visit /auth/bot-start once.");
  }
  if (stored.expires_at > Date.now() + 60_000) {
    return stored.access_token;
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Bot token refresh failed: ${res.status}`);
  const data = await res.json();

  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || stored.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await fbSet("twitch/botToken", updated);
  return updated.access_token;
}

async function getBotUserId() {
  const id = await fbGet("twitch/botUserId");
  if (!id) throw new Error("Bot user ID not stored yet — visit /auth/bot-start once.");
  return id;
}

// ---------------------------------------------------------------------
// Send a chat message as the bot into a given broadcaster's channel.
// Requires the broadcaster to have granted the bot channel:bot scope
// (handled during that channel's install flow) or the bot to be modded there.
// ---------------------------------------------------------------------
async function sendChatMessage(broadcasterId, message) {
  const token = await getBotAccessToken();
  const botUserId = await getBotUserId();

  const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Client-Id": CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      sender_id: botUserId,
      message,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Send chat message failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Create the channel.chat.message EventSub subscription for a newly
// installed channel, pointed at our webhook.
// ---------------------------------------------------------------------
async function subscribeToChatMessages(broadcasterId) {
  const appToken = await getAppAccessToken();
  const botUserId = await getBotUserId();

  const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${appToken}`,
      "Client-Id": CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: broadcasterId,
        user_id: botUserId,
      },
      transport: {
        method: "webhook",
        callback: `${process.env.PUBLIC_BASE_URL}/webhook`,
        secret: process.env.TWITCH_EVENTSUB_SECRET,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EventSub subscribe failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Exchange an OAuth "code" for tokens (used by both the bot's one-time
// authorization and each broadcaster's install flow).
async function exchangeCodeForToken(code, redirectUri) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Code exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getUserInfo(accessToken) {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Client-Id": CLIENT_ID,
    },
  });
  if (!res.ok) throw new Error(`Get user info failed: ${res.status}`);
  const data = await res.json();
  return data.data[0];
}

module.exports = {
  getAppAccessToken,
  getBotAccessToken,
  getBotUserId,
  sendChatMessage,
  subscribeToChatMessages,
  exchangeCodeForToken,
  getUserInfo,
};
