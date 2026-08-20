// netlify/functions/lib/firebase.js
//
// Talks to Firebase Realtime Database over its plain REST API using the
// project's "database secret" (Project settings > Service accounts >
// Database secrets, legacy). This is purely server-side — the secret only
// ever lives in Netlify environment variables, never shipped to a browser.
//
// Required env var: FIREBASE_DATABASE_URL, FIREBASE_DATABASE_SECRET

const BASE = process.env.FIREBASE_DATABASE_URL;
const SECRET = process.env.FIREBASE_DATABASE_SECRET;

function urlFor(path) {
  return `${BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}.json?auth=${SECRET}`;
}

async function fbGet(path) {
  const res = await fetch(urlFor(path));
  if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  return res.json();
}

async function fbSet(path, value) {
  const res = await fetch(urlFor(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function fbPatch(path, value) {
  const res = await fetch(urlFor(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status}`);
  return res.json();
}

module.exports = { fbGet, fbSet, fbPatch };
