// netlify/functions/auth-callback.js

const crypto = require("crypto");
const { fbGet, fbSet } = require("./lib/firebase");
const { exchangeCodeForToken, getUserInfo, subscribeToChatMessages } = require("./lib/twitch");

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: "Missing ?code from Twitch." };
  }

  try {
    const redirectUri = `${process.env.PUBLIC_BASE_URL}/.netlify/functions/auth-callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const broadcaster = await getUserInfo(tokenData.access_token);

    // Only create default settings + subscribe if this channel is new —
    // re-installing shouldn't wipe an existing channel's configuration.
    const existing = await fbGet(`channels/${broadcaster.id}`).catch(() => null);
    if (!existing) {
      await fbSet(`channels/${broadcaster.id}`, {
        login: broadcaster.login,
        displayName: broadcaster.display_name,
        donationEnabled: false,
        donationLink: "",
        donationCommand: "!give",
        prayerEnabled: false,
        prayerCommand: "!prayer",
        installedAt: Date.now(),
      });
      await subscribeToChatMessages(broadcaster.id);
    }

    // Simple session token so the dashboard can prove "this is really
    // the broadcaster" without us building a full auth system.
    const sessionToken = crypto.randomBytes(24).toString("hex");
    await fbSet(`sessions/${sessionToken}`, {
      broadcasterId: broadcaster.id,
      createdAt: Date.now(),
    });

    return {
      statusCode: 302,
      headers: { Location: `/dashboard.html?token=${sessionToken}` },
    };
  } catch (err) {
    return { statusCode: 500, body: `Install failed: ${err.message}` };
  }
};
