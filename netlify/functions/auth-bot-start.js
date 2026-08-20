// netlify/functions/auth-bot-start.js
//
// Visit this URL ONCE, while logged into Twitch AS the Deacon_413 bot
// account (not your own). It authorizes the bot itself to send/read chat.
// You do not need to run this again after — it's not part of any
// broadcaster's install flow.

exports.handler = async () => {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: `${process.env.PUBLIC_BASE_URL}/.netlify/functions/auth-bot-callback`,
    response_type: "code",
    scope: "user:bot user:read:chat user:write:chat",
  });

  return {
    statusCode: 302,
    headers: { Location: `https://id.twitch.tv/oauth2/authorize?${params}` },
  };
};
