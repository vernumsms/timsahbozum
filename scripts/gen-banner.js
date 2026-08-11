// Generates a per-article blog banner as standalone SVG (no browser/screenshot needed).
// CLI usage: node scripts/gen-banner.js "Makale Başlığı" service-slug images/blog/output-slug.svg
const fs = require('fs');

const ICONS = {
  'razer-gold': `<rect x="2" y="8" width="20" height="9" rx="4.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11" r="1" fill="#d9ae32" stroke="none"/><circle cx="18.5" cy="13.5" r="1" fill="#d9ae32" stroke="none"/>`,
  'pokus': `<path d="M20 12l-8-8-8 8 8 8z"/><circle cx="12" cy="9.5" r="1" fill="#d9ae32" stroke="none"/><circle cx="9" cy="12.5" r="1" fill="#d9ae32" stroke="none"/><circle cx="15" cy="12.5" r="1" fill="#d9ae32" stroke="none"/><circle cx="12" cy="15.5" r="1" fill="#d9ae32" stroke="none"/>`,
  'paycell': `<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="6.5" cy="15.5" r="1.2" fill="#d9ae32" stroke="none"/>`,
  'itunes': `<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5v8l6-4z" fill="#d9ae32" stroke="none"/>`,
  'vodafone': `<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 6h6M10 18h4"/>`,
  'turk-telekom': `<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 6h6M10 18h4"/>`,
  'mobil-odeme': `<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 6h6M10 18h4"/>`,
  'genel': `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>`,
};

const BADGE = {
  'razer-gold': 'RAZER GOLD',
  'pokus': 'POKUS',
  'paycell': 'PAYCELL',
  'itunes': 'İTUNES',
  'vodafone': 'VODAFONE',
  'turk-telekom': 'TÜRK TELEKOM',
  'mobil-odeme': 'MOBİL ÖDEME',
  'genel': 'BOZUM REHBERİ',
};

const TAGLINE = {
  'razer-gold': 'Kod bozdurma süreci, oranlar ve dikkat edilmesi gerekenler',
  'pokus': 'Pokus bakiyesi bozdurma süreci ve pratik bilgiler',
  'paycell': 'Paycell bakiyesi bozdurma süreci ve pratik bilgiler',
  'itunes': 'iTunes kodu bozdurma süreci ve dikkat edilmesi gerekenler',
  'vodafone': 'Vodafone mobil ödeme bozdurma süreci ve pratik bilgiler',
  'turk-telekom': 'Türk Telekom mobil ödeme bozdurma süreci ve pratik bilgiler',
  'mobil-odeme': 'Mobil ödeme bozdurma süreci ve pratik bilgiler',
  'genel': 'TimsahBozum ile güvenli ve hızlı bozum rehberi',
};

const CHIPS = {
  'razer-gold': ['%60 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'pokus': ['%60 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'paycell': ['%60 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'itunes': ['%55 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'vodafone': ['%50 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'turk-telekom': ['%50 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'mobil-odeme': ['%50 Oran', 'Güvenli İşlem', 'Hızlı Sonuç'],
  'genel': ['WhatsApp’tan', '10:00-03:00', 'Ücretsiz Bilgi'],
};

const CHIP_ICONS = [
  `<path d="M20 6L9 17l-5-5"/>`,
  `<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/>`,
  `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
];

const ACCENT_WORDS = ['Razer Gold', 'Pokus', 'Paycell', 'iTunes', 'Vodafone', 'Türk Telekom', 'Mobil Ödeme', 'Turkcell'];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapTitle(title, maxCharsPerLine) {
  const words = title.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (trial.length > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function headlineTspans(title, x, fontSize, lineHeight, startY) {
  const maxChars = fontSize >= 40 ? 22 : fontSize >= 34 ? 27 : 32;
  let lines = wrapTitle(title, maxChars);
  if (lines.length > 3) {
    // shrink further if still too many lines
    lines = wrapTitle(title, maxChars + 8);
  }
  return lines.map((line, i) => {
    // highlight a known service word in gold if present in this line
    let content = esc(line);
    for (const word of ACCENT_WORDS) {
      const idx = line.indexOf(word);
      if (idx !== -1) {
        const before = esc(line.slice(0, idx));
        const after = esc(line.slice(idx + word.length));
        content = `${before}<tspan fill="#d9ae32">${esc(word)}</tspan>${after}`;
        break;
      }
    }
    return `<tspan x="${x}" y="${startY + i * lineHeight}">${content}</tspan>`;
  }).join('');
}

function generateBanner({ title, service }) {
  const icon = ICONS[service] || ICONS['genel'];
  const badge = BADGE[service] || BADGE['genel'];
  const tagline = TAGLINE[service] || TAGLINE['genel'];
  const chips = CHIPS[service] || CHIPS['genel'];

  const fontSize = title.length > 55 ? 32 : title.length > 40 ? 36 : 42;
  const lineHeight = fontSize + 8;
  const headlineStartY = 158;
  const tspans = headlineTspans(title, 64, fontSize, lineHeight, headlineStartY);
  const lineCount = (tspans.match(/<tspan x=/g) || []).length;
  const lastBaselineY = headlineStartY + (lineCount - 1) * lineHeight;
  const taglineY = lastBaselineY + 46;
  const chipsY = Math.min(taglineY + 40, 352);

  const chipsSvg = chips.map((label, i) => {
    const w = 32 + label.length * 8.6;
    return { label, w, icon: CHIP_ICONS[i % CHIP_ICONS.length] };
  });
  let chipX = 64;
  const chipsMarkup = chipsSvg.map(c => {
    const markup = `
    <g transform="translate(${chipX}, ${chipsY})">
      <rect width="${c.w}" height="34" rx="9" fill="rgba(244,242,236,0.08)" stroke="rgba(244,242,236,0.16)"/>
      <g transform="translate(11, 9)" stroke="#ecc568" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${c.icon}</g>
      <text x="35" y="21" font-family="Manrope, sans-serif" font-weight="700" font-size="13.5" fill="#f4f2ec">${esc(c.label)}</text>
    </g>`;
    chipX += c.w + 12;
    return markup;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0e3a2b"/>
      <stop offset="0.55" stop-color="#082720"/>
      <stop offset="1" stop-color="#051a14"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.88" cy="0.15" r="0.55">
      <stop offset="0" stop-color="#d9ae32" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#d9ae32" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.12" cy="1" r="0.6">
      <stop offset="0" stop-color="#1b5741" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#1b5741" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="400" fill="url(#bg)"/>
  <rect width="1200" height="400" fill="url(#grid)"/>
  <rect width="1200" height="400" fill="url(#glow2)"/>
  <rect width="1200" height="400" fill="url(#glow1)"/>

  <circle cx="1080" cy="60" r="360" fill="rgba(217,174,50,0.05)"/>
  <g transform="translate(920, 110)" stroke="#d9ae32" stroke-width="1" fill="none" opacity="0.16">
    <g transform="scale(11)">${icon}</g>
  </g>

  <g transform="translate(64, 56)">
    <rect width="${badge.length * 9.6 + 34}" height="32" rx="16" fill="rgba(217,174,50,0.14)" stroke="rgba(217,174,50,0.4)"/>
    <text x="17" y="21" font-family="Manrope, sans-serif" font-weight="800" font-size="14" letter-spacing="0.06em" fill="#ecc568">${esc(badge)}</text>
  </g>

  <text font-family="Nunito, sans-serif" font-weight="900" font-size="${fontSize}" fill="#ffffff">${tspans}</text>

  <text x="64" y="${taglineY}" font-family="Manrope, sans-serif" font-weight="600" font-size="17" fill="rgba(244,242,236,0.68)">${esc(tagline)}</text>

  ${chipsMarkup}

  <g transform="translate(956, 342)">
    <rect width="36" height="36" rx="10" fill="#0e3a2b"/>
    <g transform="translate(8, 9) scale(0.38)">
      <path d="M3 27 Q2 22 8 22 L14 22 Q15 15 22 14 L23 11 L26 14 L28 10.5 L31 14 L33 10.5 L36 14 L38 11 L41 14 Q50 14 59 7 Q56 18 47 23 L46 27 L42 27 L42.5 24.5 L36 25 L35 29 L31 29 L31.5 25 L22 25 L21 29 L17 29 L17.5 25 Q10 26 3 27 Z" fill="#d9ae32"/>
      <circle cx="19" cy="18.5" r="1.7" fill="#0e3a2b"/>
    </g>
    <text x="46" y="24" font-family="Nunito, sans-serif" font-weight="800" font-size="17" fill="#ffffff">Timsah<tspan fill="#d9ae32">Bozum</tspan></text>
  </g>
</svg>
`;
}

module.exports = { generateBanner };

if (require.main === module) {
  const title = process.argv[2];
  const service = process.argv[3] || 'genel';
  const outPath = process.argv[4];
  if (!title || !outPath) {
    console.error('Kullanim: node scripts/gen-banner.js "Makale Basligi" service-slug images/blog/cikti-slug.svg');
    process.exit(1);
  }
  const svg = generateBanner({ title, service });
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log('written', outPath);
}
