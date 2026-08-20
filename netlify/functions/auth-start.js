// netlify/functions/auth-start.js
//
// "Add Deacon_413 to your channel" button points here. Redirects the
// broadcaster to Twitch to grant the channel:bot scope, which lets the
// bot read/send chat in their channel without needing full moderator status.

exports.handler = async () => {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    redirect_uri: `${process.env.PUBLIC_BASE_URL}/.netlify/functions/auth-callback`,
    response_type: "code",
    scope: "channel:bot",
  });

  return {
    statusCode: 302,
    headers: { Location: `https://id.twitch.tv/oauth2/authorize?${params}` },
  };
};
