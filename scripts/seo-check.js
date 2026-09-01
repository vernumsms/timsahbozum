#!/usr/bin/env node
/* TimsahBozum blog makalesi SEO ön-yayın kontrolü.
   Kullanım:
     node scripts/seo-check.js blog/<slug>.html     -> tek makale
     node scripts/seo-check.js --all                -> blog/ altındaki tüm makaleler
   Çıkış kodu: 0 = tüm kontroller geçti, 1 = en az bir HATA.
   Rutin bu scripti commit'ten ÖNCE çalıştırır; HATA varsa yayın yapılmaz. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://timsahbozum.com/";
const SERVICE_PAGES = [
  "razer-gold-bozdurma.html", "pokus-bozdurma.html", "paycell-bozdurma.html", "itunes-bakiye-bozdurma.html", "google-play-bozdurma.html",
  "mobil-odeme-bozdurma.html", "vodafone-mobil-odeme-bozdurma.html", "turk-telekom-mobil-odeme-bozdurma.html",
  "turkcell-mobil-odeme-bozdurma.html",
];

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', "i"));
  return m ? m[1] : null;
}
function metaContent(html, selector) {
  // selector: {name:'description'} | {property:'og:title'}
  const key = Object.keys(selector)[0];
  const re = new RegExp("<meta[^>]*" + key + '\\s*=\\s*"' + selector[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"[^>]*>', "i");
  const m = html.match(re);
  return m ? attr(m[0], "content") : null;
}
function stripText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkPost(rel) {
  const file = path.resolve(ROOT, rel);
  const slug = path.basename(file, ".html");
  const errors = [], warns = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warns.push(m);
  if (!fs.existsSync(file)) return { slug, errors: ["dosya yok: " + rel], warns };
  const html = fs.readFileSync(file, "utf8");
  const canonicalUrl = SITE + "blog/" + slug + ".html";

  // --- temel etiketler
  if (!/<html[^>]*lang="tr"/i.test(html)) err('<html lang="tr"> yok');
  if (!/<meta[^>]*name="viewport"/i.test(html)) err("viewport meta yok");
  if (/name="robots"[^>]*noindex/i.test(html)) err("noindex var");

  // --- title
  const tm = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = tm ? tm[1].trim() : "";
  if (!title) err("<title> yok");
  else {
    if (title.length > 62) err(`title ${title.length} karakter (>62): "${title}"`);
    else if (title.length > 60) warn(`title ${title.length} karakter (hedef ≤60): "${title}"`);
    if (title.length < 25) err(`title çok kısa (${title.length})`);
    if (!/TimsahBozum/.test(title)) err("title'da 'TimsahBozum' yok");
  }

  // --- description
  const desc = metaContent(html, { name: "description" }) || "";
  if (!desc) err("meta description yok");
  else if (desc.length < 120 || desc.length > 160) err(`description ${desc.length} karakter (120-160 olmalı)`);

  // --- canonical + OG + twitter
  const cm = html.match(/<link[^>]*rel="canonical"[^>]*>/i);
  const canon = cm ? attr(cm[0], "href") : null;
  if (canon !== canonicalUrl) err(`canonical yanlış: ${canon} (beklenen ${canonicalUrl})`);
  const ogTitle = metaContent(html, { property: "og:title" });
  const ogDesc = metaContent(html, { property: "og:description" });
  const ogUrl = metaContent(html, { property: "og:url" });
  const ogImg = metaContent(html, { property: "og:image" });
  const ogType = metaContent(html, { property: "og:type" });
  if (!ogTitle) err("og:title yok");
  if (!ogDesc) err("og:description yok");
  if (ogUrl !== canonicalUrl) err(`og:url canonical ile aynı değil: ${ogUrl}`);
  if (!ogImg || !/^https:\/\/timsahbozum\.com\/images\//.test(ogImg)) err("og:image yok/yanlış");
  if (ogType !== "article") warn("og:type 'article' değil");
  if (!metaContent(html, { name: "twitter:card" })) err("twitter:card yok");

  // --- başlıklar
  const h1s = html.match(/<h1[\s>]/gi) || [];
  if (h1s.length !== 1) err(`H1 sayısı ${h1s.length} (1 olmalı)`);
  const h2s = (html.match(/<h2[\s>]/gi) || []).length;
  const h3s = (html.match(/<h3[\s>]/gi) || []).length;
  if (h2s + h3s < 4) err(`alt başlık az: h2=${h2s} h3=${h3s} (en az 4)`);

  // --- JSON-LD
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!blocks.length) err("JSON-LD yok");
  const types = new Set();
  let posting = null;
  let faqPage = null;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        if (o["@type"]) types.add(o["@type"]);
        if (o["@type"] === "BlogPosting") posting = o;
        if (o["@type"] === "FAQPage") faqPage = o;
        for (const v of Object.values(o)) walk(v);
      };
      walk(j);
    } catch (e) { err("JSON-LD parse hatası: " + e.message.slice(0, 80)); }
  }
  for (const t of ["BlogPosting", "BreadcrumbList", "Organization"]) if (!types.has(t)) err(`JSON-LD'de ${t} yok`);
  if (posting) {
    if (!posting.headline) err("BlogPosting.headline yok");
    else if (posting.headline.length > 110) warn("BlogPosting.headline 110 karakterden uzun");
    if (!/^\d{4}-\d{2}-\d{2}/.test(posting.datePublished || "")) err("BlogPosting.datePublished ISO tarih değil");
    if (!posting.description) err("BlogPosting.description yok");
    const mep = posting.mainEntityOfPage && (posting.mainEntityOfPage["@id"] || posting.mainEntityOfPage);
    if (mep && mep !== canonicalUrl) err(`BlogPosting.mainEntityOfPage canonical değil: ${mep}`);
    if (posting.url && posting.url !== canonicalUrl) err(`BlogPosting.url canonical değil: ${posting.url}`);
  }

  // --- SSS / FAQPage senkronu
  const visibleFaq = (html.match(/class="faq-question"/g) || []).length;
  if (visibleFaq === 0) {
    warn("görünür SSS bölümü yok (FAQ hem zengin sonuç hem AI alıntısı için önemli)");
  } else if (visibleFaq > 0 && !faqPage) {
    warn(`görünür SSS var (${visibleFaq} soru) ama FAQPage JSON-LD yok`);
  } else if (visibleFaq > 0 && faqPage) {
    const ldFaq = Array.isArray(faqPage.mainEntity) ? faqPage.mainEntity.length : 0;
    if (ldFaq !== visibleFaq) warn(`SSS senkron değil: görünür ${visibleFaq} soru, FAQPage JSON-LD ${ldFaq} soru`);
  }

  // --- gövde
  const bodyMatch = html.match(/<body[\s\S]*<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[0].replace(/<header[\s\S]*?<\/header>/i, "").replace(/<footer[\s\S]*?<\/footer>/i, "") : html;
  const words = stripText(bodyHtml).split(" ").filter(Boolean).length;
  if (words < 600) err(`kelime sayısı ${words} (<600)`);
  else if (words < 900) warn(`kelime sayısı ${words} (hedef 1000-1400)`);

  // --- banner
  const banner = html.match(/<img[^>]*class="article-banner"[^>]*>/i);
  if (!banner) err("article-banner img yok");
  else {
    const src = attr(banner[0], "src") || "";
    const alt = attr(banner[0], "alt") || "";
    if (src !== `../images/blog/${slug}.svg`) err(`banner src beklenen ../images/blog/${slug}.svg, bulunan ${src}`);
    if (!fs.existsSync(path.join(ROOT, "images/blog", slug + ".svg"))) err(`banner dosyası yok: images/blog/${slug}.svg`);
    if (alt.trim().length < 10) err("banner alt metni yok/çok kısa");
    if (!attr(banner[0], "width") || !attr(banner[0], "height")) warn("banner width/height yok (CLS)");
  }
  // diğer görsellerde alt
  for (const m of html.matchAll(/<img[^>]*>/gi)) if (!/alt="/.test(m[0])) err("alt'sız img: " + m[0].slice(0, 80));

  // --- linkler
  const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"#]+)"/gi)].map((m) => m[1]);
  const internal = hrefs.filter((h) => !/^(https?:|mailto:|tel:|javascript:)/i.test(h));
  for (const h of new Set(internal)) {
    const target = path.resolve(path.dirname(file), h.split("?")[0]);
    if (!fs.existsSync(target)) err(`kırık iç link: ${h}`);
  }
  if (!internal.some((h) => SERVICE_PAGES.some((s) => h === "../" + s))) err("hizmet sayfasına (../*-bozdurma.html) link yok");
  const related = html.match(/<h2>İlgili Yazılar<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i) || html.match(/<h2>Ilgili Yazilar<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i);
  if (!related) err("'İlgili Yazılar' bloğu yok");
  else {
    const n = (related[1].match(/<a\s/gi) || []).length;
    if (n < 2) err(`İlgili Yazılar'da ${n} link (en az 2)`);
  }
  if (!internal.some((h) => /^\.\.\/go\//.test(h))) err("go/ WhatsApp yönlendirme linki yok");
  const goFile = path.join(ROOT, "go", "blog-" + slug + ".html");
  if (!fs.existsSync(goFile)) err(`go/blog-${slug}.html yok`);
  if (/https:\/\/wa\.me\/[^"]*"[^>]*>/.test(html) && !/go\//.test(html)) warn("doğrudan wa.me linki var, go/ tercih edilmeli");

  // --- performans / şablon bütünlüğü
  if (/fonts\.googleapis\.com/.test(html)) err("Google Fonts bağlantısı var (fontlar self-host, kaldır)");
  const preloads = (html.match(/rel="preload" as="font"[^>]*nunito-latin(-ext)?\.woff2/gi) || []).length;
  if (preloads < 2) err(`Nunito preload satırı ${preloads}/2`);
  if (!/href="\.\.\/css\/style\.css"/.test(html)) err("../css/style.css yok");
  if (!/cloudflareinsights\.com\/beacon/.test(html)) err("Cloudflare analitik beacon yok");
  if (!/\.\.\/js\/script\.js/.test(html)) err("../js/script.js yok");

  // --- blog.html kartı + sitemap
  const blogList = fs.readFileSync(path.join(ROOT, "blog.html"), "utf8");
  const cardRe = new RegExp('<a href="blog/' + slug + '\\.html" class="blog-card">([\\s\\S]*?)</a>', "i");
  const card = blogList.match(cardRe);
  if (!card) err("blog.html'de kart yok");
  else {
    if (!new RegExp('src="images/blog/' + slug + '\\.svg"').test(card[1])) err("blog.html kartında banner görseli yok/yanlış");
    if (!/class="blog-date"/.test(card[1]) || !/<h3>/.test(card[1])) err("blog.html kartı eksik (blog-date/h3)");
  }
  const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  if (!sitemap.includes("<loc>" + canonicalUrl + "</loc>")) err("sitemap.xml'de girdi yok");

  // --- başlık tekrarı (diğer makalelerle)
  for (const other of fs.readdirSync(path.join(ROOT, "blog"))) {
    if (!other.endsWith(".html") || other === slug + ".html") continue;
    const ot = (fs.readFileSync(path.join(ROOT, "blog", other), "utf8").match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
    if (ot && ot.trim() === title) err("aynı title başka makalede de var: " + other);
  }

  return { slug, errors, warns, words, title, desc };
}

// ---- main
const args = process.argv.slice(2);
let files = [];
if (args.includes("--all")) {
  files = fs.readdirSync(path.join(ROOT, "blog")).filter((f) => f.endsWith(".html")).map((f) => "blog/" + f);
} else {
  files = args.filter((a) => !a.startsWith("--"));
}
if (!files.length) { console.error("Kullanım: node scripts/seo-check.js blog/<slug>.html | --all"); process.exit(2); }

let failed = 0;
for (const f of files) {
  const r = checkPost(f);
  const status = r.errors.length ? "HATA" : "OK";
  if (r.errors.length) failed++;
  console.log(`[${status}] ${r.slug}${r.words ? ` (${r.words} kelime)` : ""}`);
  for (const e of r.errors) console.log("   ✗ " + e);
  for (const w of r.warns) console.log("   · " + w);
}
console.log(`\n${files.length} makale kontrol edildi, ${failed} hatalı.`);
process.exit(failed ? 1 : 0);
