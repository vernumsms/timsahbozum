// Hizmet sayfalarindaki "Blogdan ilgili rehberler" blogunun altina, o hizmetin en yeni
// makalelerini (sayfada zaten linkli olmayanlar) SERVIS-REHBER:START/END isaretleri arasina yazar.
// Amac: dizinde olan ve sik taranan hizmet sayfalarindan yeni makalelere kesif yolu acmak.
// Kullanim: node scripts/update-service-guides.js   (repo kokunden; --check sadece kontrol eder)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LIMIT = 6;
const PAGES = {
  "razer-gold": "razer-gold-bozdurma.html",
  itunes: "itunes-bakiye-bozdurma.html",
  "google-play": "google-play-bozdurma.html",
  pokus: "pokus-bozdurma.html",
  paycell: "paycell-bozdurma.html",
  vodafone: "vodafone-mobil-odeme-bozdurma.html",
  "turk-telekom": "turk-telekom-mobil-odeme-bozdurma.html",
  turkcell: "turkcell-mobil-odeme-bozdurma.html",
  "mobil-odeme": "mobil-odeme-bozdurma.html",
  genel: "mobil-bozum.html",
};
const START = "<!-- SERVIS-REHBER:START -->";
const END = "<!-- SERVIS-REHBER:END -->";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const check = process.argv.includes("--check");
const topics = JSON.parse(fs.readFileSync(path.join(ROOT, "blog/topics-queue.json"), "utf8")).topics;
const published = topics
  .filter((t) => t.published && fs.existsSync(path.join(ROOT, "blog", t.slug + ".html")))
  .sort((a, b) => (b.published_at || b.published_date || "").localeCompare(a.published_at || a.published_date || ""));

let stale = 0;
for (const [service, page] of Object.entries(PAGES)) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, "utf8");
  const withoutBlock = html.replace(new RegExp(`\\s*${START}[\\s\\S]*?${END}`), "");
  const picks = published
    .filter((t) => t.service === service && !withoutBlock.includes(`blog/${t.slug}.html`))
    .slice(0, LIMIT);
  const block = picks.length
    ? `${START}\n        <h3>Yeni eklenen rehberler</h3>\n        <ul>\n${picks
        .map((t) => `          <li><a href="blog/${t.slug}.html">${esc(t.title)}</a></li>`)
        .join("\n")}\n        </ul>\n        ${END}`
    : `${START}${END}`;

  let next;
  if (html.includes(START)) {
    next = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  } else {
    const h = html.indexOf("Blogdan ilgili rehberler");
    const ul = h === -1 ? -1 : html.indexOf("</ul>", h);
    if (ul === -1) { console.log(`ATLANDI (rehber blogu yok): ${page}`); continue; }
    next = html.slice(0, ul + 5) + "\n        " + block + html.slice(ul + 5);
  }
  if (next !== html) {
    stale++;
    if (!check) fs.writeFileSync(file, next);
    console.log(`${check ? "GUNCEL DEGIL" : "guncellendi"}: ${page} (${picks.length} yeni link)`);
  }
}
if (check && stale) process.exit(1);
if (!stale) console.log("Tum hizmet sayfalari guncel.");
