// netlify/functions/settings-get.js

const { fbGet } = require("./lib/firebase");

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 401, body: "Missing token." };

  const session = await fbGet(`sessions/${token}`).catch(() => null);
  if (!session) return { statusCode: 401, body: "Invalid or expired session." };

  const settings = await fbGet(`channels/${session.broadcasterId}`).catch(() => null);
  if (!settings) return { statusCode: 404, body: "Channel not found." };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  };
};
