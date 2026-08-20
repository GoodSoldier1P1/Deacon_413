// netlify/functions/auth-bot-callback.js

const { fbSet } = require("./lib/firebase");
const { exchangeCodeForToken, getUserInfo } = require("./lib/twitch");

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: "Missing ?code from Twitch." };
  }

  try {
    const redirectUri = `${process.env.PUBLIC_BASE_URL}/.netlify/functions/auth-bot-callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const user = await getUserInfo(tokenData.access_token);

    await fbSet("twitch/botToken", {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    });
    await fbSet("twitch/botUserId", user.id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<html><body style="font-family:sans-serif;padding:40px;">
        <h2>Deacon_413 bot authorized ✅</h2>
        <p>Signed in as <b>${user.display_name}</b> (user id ${user.id}).</p>
        <p>This only needed to happen once. You can close this tab.</p>
      </body></html>`,
    };
  } catch (err) {
    return { statusCode: 500, body: `Bot authorization failed: ${err.message}` };
  }
};
