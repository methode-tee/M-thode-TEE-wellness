import { SignJWT, importPKCS8, type KeyLike } from "npm:jose@5.9.6";

type ApnsMessage = {
  title: string;
  body: string;
  url?: string;
  badge?: number;
  collapseId?: string;
};

let cachedKey: KeyLike | null = null;
let cachedJwt = "";
let cachedAt = 0;

function env(name: string, fallback = "") {
  return Deno.env.get(name) || fallback;
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

async function providerToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedAt < 45 * 60) return cachedJwt;

  const keyId = env("APNS_KEY_ID");
  const teamId = env("APNS_TEAM_ID");
  const privateKey = normalizePrivateKey(env("APNS_PRIVATE_KEY"));
  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNS_SECRETS_MISSING");
  }
  if (!cachedKey) cachedKey = await importPKCS8(privateKey, "ES256");
  cachedJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(cachedKey);
  cachedAt = now;
  return cachedJwt;
}

async function readReason(res: Response) {
  try {
    const data = await res.clone().json();
    return String(data?.reason || data?.error || "");
  } catch (_) {
    return "";
  }
}

async function postToApns(token: string, message: ApnsMessage, host: string) {
  const jwt = await providerToken();
  const bundleId = env("APNS_BUNDLE_ID", "com.methodetee.app");
  const aps: Record<string, unknown> = {
    alert: { title: message.title, body: message.body },
    sound: "default",
  };
  if (Number.isFinite(message.badge)) aps.badge = Number(message.badge);

  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    "apns-topic": bundleId,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
  if (message.collapseId) headers["apns-collapse-id"] = message.collapseId.slice(0, 64);

  const payload = {
    aps,
    url: message.url || "index.html",
    source: "methode_tee",
  };
  const res = await fetch(`${host}/3/device/${encodeURIComponent(token)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, reason: await readReason(res) };
}

export async function sendApns(token: string, message: ApnsMessage) {
  const preferred = env("APNS_ENV", "production").toLowerCase();
  const production = "https://api.push.apple.com";
  const sandbox = "https://api.sandbox.push.apple.com";
  const first = preferred === "sandbox" ? sandbox : production;
  const second = first === production ? sandbox : production;

  let result = await postToApns(token, message, first);
  if (!result.ok && ["BadDeviceToken", "DeviceTokenNotForTopic"].includes(result.reason)) {
    const retry = await postToApns(token, message, second);
    if (retry.ok) return retry;
    result = retry;
  }
  return result;
}

export function shouldDisableNativeToken(status: number, reason: string) {
  return status === 410 || ["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"].includes(reason);
}
