#!/usr/bin/env node
/* Ana sayfadaki "Son yazılar" bloğunu blog.html'deki en yeni kartlardan üretir.
   Kullanım: node scripts/update-recent-posts.js        -> index.html'i günceller
             node scripts/update-recent-posts.js --check -> günceller mi diye bakar, güncel değilse çıkış kodu 1
   Kaynak: blog.html içindeki blog-card sırası (rutin yeni makaleyi en üste ekler).
   Hedef: index.html içindeki <!-- SON-YAZILAR:START --> ... <!-- SON-YAZILAR:END --> arası.
   Amaç: Google ana sayfayı sık tarar; yeni makalelere ana sayfadan statik link vermek keşfi hızlandırır. */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COUNT = 6;
const START = "<!-- SON-YAZILAR:START -->";
const END = "<!-- SON-YAZILAR:END -->";

function esc(s) {
  return String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function recentFromBlogList() {
  const html = fs.readFileSync(path.join(ROOT, "blog.html"), "utf8");
  const re = /<a href="(blog\/[^"]+\.html)" class="blog-card">[\s\S]*?<span class="blog-date">([^<]*)<\/span>\s*<h3>([\s\S]*?)<\/h3>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) && out.length < COUNT) {
    out.push({ href: m[1], date: m[2].trim(), title: m[3].replace(/\s+/g, " ").trim() });
  }
  return out;
}

function render(items) {
  const lis = items
    .map((it) => `        <li><a href="${it.href}">${esc(it.title)}</a><time>${esc(it.date)}</time></li>`)
    .join("\n");
  return `${START}
    <div class="recent-posts">
      <h3>Son yazılar</h3>
      <ul>
${lis}
      </ul>
    </div>
    ${END}`;
}

const indexPath = path.join(ROOT, "index.html");
const raw = fs.readFileSync(indexPath, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const index = raw.replace(/\r\n/g, "\n");
const s = index.indexOf(START), e = index.indexOf(END);
if (s < 0 || e < 0) {
  console.error("index.html içinde SON-YAZILAR işaretleri yok.");
  process.exit(2);
}
const items = recentFromBlogList();
if (items.length < 3) {
  console.error("blog.html'den yeterli kart okunamadı:", items.length);
  process.exit(2);
}
const next = index.slice(0, s) + render(items) + index.slice(e + END.length);
const changed = next !== index;

if (process.argv.includes("--check")) {
  if (changed) {
    console.log("index.html 'Son yazılar' bloğu güncel değil → node scripts/update-recent-posts.js çalıştır.");
    process.exit(1);
  }
  console.log("index.html 'Son yazılar' bloğu güncel.");
  process.exit(0);
}

if (changed) {
  fs.writeFileSync(indexPath, next.replace(/\r?\n/g, EOL));
  console.log("index.html güncellendi:", items.map((i) => i.href.replace("blog/", "")).join(", "));
} else {
  console.log("index.html zaten güncel.");
}
