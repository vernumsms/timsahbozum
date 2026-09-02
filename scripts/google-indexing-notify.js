// Google Indexing API bildirimi — her makale yayininda (sitemap.xml degisince) calisir.
// Sitemap'te YENI eklenen veya lastmod'u DEGISEN URL'leri Google'a "URL_UPDATED" olarak bildirir.
//
// Kullanim:
//   node scripts/google-indexing-notify.js                 -> BEFORE_SHA (git) ile mevcut sitemap'i karsilastirir
//   node scripts/google-indexing-notify.js <url> [url...]  -> verilen URL'leri bildirir
// Ortam: GSC_SA_JSON = servis hesabi anahtari (JSON metni, GitHub secret). BEFORE_SHA = onceki commit (opsiyonel).
// Servis hesabi GSC mulkunde Owner olmali. Kota: 200 bildirim/gun.
// Not: Anahtar dosyasi repoya ASLA eklenmez; yalnizca GitHub Actions secret'i olarak durur.
const fs = require("fs");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const SITEMAP_FILE = "sitemap.xml";
const key = JSON.parse(process.env.GSC_SA_JSON || "null");
if (!key) { console.error("GSC_SA_JSON ortam degiskeni yok"); process.exit(1); }

const b64url = (s) => Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope: "https://www.googleapis.com/auth/indexing", aud: key.token_uri, iat: now, exp: now + 3600 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(header + "." + claims), key.private_key).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await fetch(key.token_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: header + "." + claims + "." + sig }) });
  if (!res.ok) throw new Error("token: " + res.status + " " + (await res.text()));
  return (await res.json()).access_token;
}

function parseSitemap(xml) {
  const map = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) map.set(m[1].trim(), (m[2] || "").trim());
  return map;
}

function changedUrls() {
  const now = parseSitemap(fs.readFileSync(SITEMAP_FILE, "utf8"));
  let before = new Map();
  const sha = process.env.BEFORE_SHA;
  if (sha && !/^0+$/.test(sha)) {
    try { before = parseSitemap(execFileSync("git", ["show", `${sha}:${SITEMAP_FILE}`], { encoding: "utf8" })); }
    catch (e) { console.log("Onceki sitemap okunamadi (" + e.message.split("\n")[0] + "), son 2 gunde degisenler bildirilecek"); }
  }
  if (before.size === 0) {
    const cutoff = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    return [...now].filter(([, lm]) => lm >= cutoff).map(([u]) => u);
  }
  return [...now].filter(([u, lm]) => !before.has(u) || before.get(u) !== lm).map(([u]) => u);
}

(async () => {
  const urls = process.argv.length > 2 ? process.argv.slice(2) : changedUrls();
  if (!urls.length) { console.log("Bildirilecek URL yok (sitemap'te yeni/degisen kayit bulunmadi)."); return; }
  console.log(`${urls.length} URL bildirilecek:`);
  const tk = await token();
  let ok = 0;
  for (const u of urls) {
    const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", { method: "POST", headers: { authorization: "Bearer " + tk, "content-type": "application/json" }, body: JSON.stringify({ url: u, type: "URL_UPDATED" }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) ok++;
    console.log(r.ok ? `  OK   ${u}` : `  HATA ${r.status} ${u} ${JSON.stringify(j).slice(0, 160)}`);
  }
  console.log(`${ok}/${urls.length} bildirim basarili`);
  if (ok < urls.length) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(1); });
