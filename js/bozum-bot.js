/* TimsahBozum canlı destek + gece sipariş botu.
   Gündüz: WhatsApp'a yönlendirir. Gece (mesai dışı): Razer Gold / iTunes için sipariş alır,
   kodu güvenle sıraya koyar (Worker paneli), ödemenin sabah elle kontrol edilip yapılacağını bildirir.
   Otomatik doğrulama/ajan yok (26.08.2026'da kaldırıldı); bot sipariş sonrası beklemez.
   Backend: Cloudflare Worker (WORKER_URL). Statik siteye tek script ile eklenir. */
(function () {
  "use strict";

  var WORKER_URL = "https://bozum-night.timsahbozum.workers.dev";
  var WA_BASE = "https://wa.me/905438872171?text=";

  var RATES = { razer: 70, itunes: 55 }; // /api/status ile güncellenir
  var night = false;

  // ---- stil ----
  var css = "" +
    ".tb-bot-btn{position:fixed;right:24px;bottom:96px;width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#1b5741,#082720);border:2px solid #d9ae32;color:#ecc568;cursor:pointer;z-index:9998;box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:26px}" +
    ".tb-bot-btn:hover{transform:translateY(-2px)}" +
    ".tb-bot-panel{position:fixed;right:24px;bottom:164px;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 190px);background:#0f1a14;border:1px solid #24413298;border-radius:16px;z-index:9999;display:none;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:system-ui,sans-serif}" +
    ".tb-bot-panel.open{display:flex}" +
    ".tb-bot-head{background:linear-gradient(135deg,#123f2f,#082720);padding:12px 14px;color:#e7f5ec;display:flex;align-items:center;gap:8px}" +
    ".tb-bot-head b{font-size:15px}.tb-bot-head small{color:#9fd3b6;font-size:12px;display:block}" +
    ".tb-bot-dot{width:9px;height:9px;border-radius:50%;background:#3ddc84}.tb-bot-dot.night{background:#d9ae32}" +
    ".tb-bot-x{margin-left:auto;background:none;border:none;color:#9fd3b6;font-size:20px;cursor:pointer}" +
    ".tb-bot-body{flex:1 1 auto;min-height:48px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
    "#tbActions{overflow-y:auto;max-height:62%;flex:0 0 auto}" +
    ".tb-msg{background:#16281f;color:#e7f5ec;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.5;max-width:90%}" +
    ".tb-msg.user{align-self:flex-end;background:#1b5741;color:#eafff2}" +
    ".tb-opts{display:flex;flex-direction:column;gap:6px;padding:0 14px 12px}" +
    ".tb-opt{text-align:left;background:#16281f;color:#ecc568;border:1px solid #2c4d3c;border-radius:10px;padding:9px 12px;cursor:pointer;font-size:14px}" +
    ".tb-opt:hover{border-color:#d9ae32}" +
    ".tb-field{display:flex;flex-direction:column;gap:6px;padding:0 14px 12px}" +
    ".tb-field input{background:#0c1611;border:1px solid #2c4d3c;border-radius:8px;color:#e7f5ec;padding:9px;font-size:14px}" +
    ".tb-coderow{display:flex;gap:6px;margin-bottom:6px}" +
    ".tb-coderow .tb-code{flex:2;min-width:0;background:#0c1611;border:1px solid #2c4d3c;border-radius:8px;color:#e7f5ec;padding:9px;font-size:14px}" +
    ".tb-coderow .tb-amt{flex:1;min-width:0;background:#0c1611;border:1px solid #2c4d3c;border-radius:8px;color:#e7f5ec;padding:9px;font-size:14px}" +
    ".tb-coderow .tb-rm{flex:0 0 auto;background:#2a1414;color:#f0a0a0;border:1px solid #613;border-radius:8px;cursor:pointer;padding:0 10px;font-size:16px}" +
    ".tb-add{background:none;color:#ecc568;border:1px dashed #2c4d3c;border-radius:8px;padding:8px;cursor:pointer;font-size:13px;margin-bottom:10px}" +
    ".tb-add:hover{border-color:#d9ae32}" +
    ".tb-done{background:#123f2f;color:#eafff2;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.55;max-width:92%;border:1px solid #2c6b4f}" +
    ".tb-field button{background:linear-gradient(135deg,#ecc568,#d9ae32);color:#082720;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:14px}" +
    ".tb-err{color:#f0a0a0;font-size:12px;padding:0 14px}" +
    ".tb-bot-foot{padding:8px 14px;font-size:11px;color:#6f9a83;border-top:1px solid #1c3327}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- DOM ----
  var btn = document.createElement("button");
  btn.className = "tb-bot-btn";
  btn.setAttribute("aria-label", "Canlı destek");
  btn.innerHTML = "💬";

  var panel = document.createElement("div");
  panel.className = "tb-bot-panel";
  panel.innerHTML =
    '<div class="tb-bot-head"><span class="tb-bot-dot" id="tbDot"></span><div><b>TimsahBozum Destek</b><small id="tbSub">Bağlanıyor…</small></div><button class="tb-bot-x" aria-label="Kapat">×</button></div>' +
    '<div class="tb-bot-body" id="tbBody"></div>' +
    '<div id="tbActions"></div>' +
    '<div class="tb-bot-foot">Ödemeler yalnızca WhatsApp üzerinden görüşülür. SMS/doğrulama kodu istenmez.</div>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var body = panel.querySelector("#tbBody");
  var actions = panel.querySelector("#tbActions");
  var sub = panel.querySelector("#tbSub");
  var dot = panel.querySelector("#tbDot");

  function bot(t) { var d = document.createElement("div"); d.className = "tb-msg"; d.innerHTML = t; body.appendChild(d); body.scrollTop = body.scrollHeight; }
  function me(t) { var d = document.createElement("div"); d.className = "tb-msg user"; d.textContent = t; body.appendChild(d); body.scrollTop = body.scrollHeight; }
  function clearActions() { actions.innerHTML = ""; }
  function opts(list) {
    clearActions();
    var wrap = document.createElement("div"); wrap.className = "tb-opts";
    list.forEach(function (o) {
      var b = document.createElement("button"); b.className = "tb-opt"; b.textContent = o.label;
      b.onclick = o.onClick; wrap.appendChild(b);
    });
    actions.appendChild(wrap);
  }
  function wa(text) { return WA_BASE + encodeURIComponent(text); }

  // ---- akışlar ----
  function home() {
    clearActions();
    opts([
      { label: "💱 Bozum yaptırmak istiyorum", onClick: menuServices },
      { label: "📊 Güncel oranlar nedir?", onClick: showRates },
      { label: "🔒 Güvenli mi, nasıl çalışıyor?", onClick: showHow },
      { label: "🕒 Çalışma saatleri", onClick: showHours },
    ]);
  }

  function showRates() {
    me("Güncel oranlar nedir?");
    bot("Güncel ödeme oranlarımız: Razer Gold %70, Pokus %60, Paycell %60, iTunes %55, Vodafone ve Türk Telekom mobil ödeme %50, Turkcell %30 (Paycell üzerinden %60). Oranlar değişebilir, işlem öncesi WhatsApp'tan teyit et.");
    setTimeout(home, 400);
  }
  function showHow() {
    me("Güvenli mi, nasıl çalışıyor?");
    bot("Süreç: WhatsApp'tan yazarsın, kod/bakiye bilgini paylaşırsın, oranı teyit ederiz, onaydan sonra ödeme WhatsApp'ta görüşülen yöntemle yapılır. Üyelik, form, kimlik gerekmez; hesabına erişim istenmez. <b>SMS doğrulama kodu asla istenmez</b> — isteyen olursa dolandırıcıdır.");
    setTimeout(home, 400);
  }
  function showHours() {
    me("Çalışma saatleri");
    if (night) bot("Şu an mesai dışındayız (çalışma saatlerimiz her gün 10:00–03:00). Ama Razer Gold ve iTunes işlemini <b>şimdi sıraya alabilirsin</b>, ödemen sabah 10:00'dan itibaren yapılır.");
    else bot("Çalışma saatlerimiz her gün 10:00–03:00. Şu an açığız, WhatsApp'tan hemen yazabilirsin.");
    setTimeout(home, 400);
  }

  function menuServices() {
    me("Bozum yaptırmak istiyorum");
    if (night) {
      bot("Şu an mesai dışıyız. Razer Gold ve iTunes işlemlerini şimdi sıraya alıp sabah ödeyebiliriz. Diğer hizmetler için gündüz WhatsApp'tan yazman gerekir.");
      opts([
        { label: "🎮 Razer Gold (gece sıraya al)", onClick: razerNight },
        { label: "🍎 iTunes (gece sıraya al)", onClick: itunesNight },
        { label: "📱 Diğer hizmetler (WhatsApp)", onClick: function () { location.href = wa("Merhaba, TimsahBozum. Mesai açılınca bozum yaptırmak istiyorum."); } },
      ]);
    } else {
      bot("Hemen WhatsApp'tan yazabilirsin, oranı teyit edip işlemi başlatalım. Hangi hizmet?");
      opts([
        { label: "🎮 Razer Gold", onClick: function () { location.href = wa("Merhaba, TimsahBozum. Razer Gold bozdurmak istiyorum."); } },
        { label: "🍎 iTunes", onClick: function () { location.href = wa("Merhaba, TimsahBozum. iTunes bakiye bozdurmak istiyorum."); } },
        { label: "📱 Mobil ödeme / diğer", onClick: function () { location.href = wa("Merhaba, TimsahBozum. Bozum yaptırmak istiyorum."); } },
      ]);
    }
  }

  // gece Razer
  function razerNight() {
    me("Razer Gold (gece)");
    bot("⚠️ Yalnızca <b>Razer Gold TL</b> kodları kabul edilir. Global veya farklı para birimi (USD, EUR vb.) kodları işleme alınmaz.");
    bot("Razer Gold TL kodunu şimdi güvenle sıraya alalım. Kodun <b>sabah 10:00'dan itibaren</b> kontrol edilir, geçerliyse ödemen <b>gerçek yüklenen tutar</b> üzerinden IBAN'ına yapılır ve sonucu WhatsApp'tan bildirilir. Ödeme oranı %" + RATES.razer + ". Devam edelim mi?");
    opts([
      { label: "✅ Evet, sıraya al", onClick: function () { form("razer"); } },
      { label: "↩︎ Geri", onClick: menuServices },
    ]);
  }
  function itunesNight() {
    me("iTunes (gece)");
    bot("⚠️ iTunes işlemi <b>yalnızca maile gönderilen hediye kartı</b> şeklinde kabul edilir. Hediye kartını <b>kod@timsahbozum.com</b> adresine gönderirsin; sabah 10:00'dan itibaren kontrol edilir. Ödeme oranı %" + RATES.itunes + ", ödemen kontrol sonrası yapılır. Önce sipariş bilgilerini alalım.");
    opts([
      { label: "✅ Evet, sıraya al", onClick: function () { form("itunes"); } },
      { label: "↩︎ Geri", onClick: menuServices },
    ]);
  }

  function codeRow(first) {
    var row = document.createElement("div"); row.className = "tb-coderow";
    row.innerHTML =
      '<input class="tb-code" placeholder="Razer Gold kodu (kod + seri no)" autocomplete="off">' +
      '<input class="tb-amt" placeholder="TL değeri" inputmode="numeric" autocomplete="off">' +
      (first ? "" : '<button class="tb-rm" aria-label="Kaldır">×</button>');
    if (!first) row.querySelector(".tb-rm").onclick = function () { row.remove(); };
    return row;
  }

  function form(service) {
    clearActions();
    var f = document.createElement("div"); f.className = "tb-field";

    var codesWrap = null, addBtn = null;
    if (service === "razer") {
      var note = document.createElement("div");
      note.style.cssText = "color:#9fd3b6;font-size:12px;padding:0 2px 8px";
      note.innerHTML = "Yalnızca <b>Razer Gold TL</b> kodu. Kodu ve TL değerini gir; birden fazla kod ekleyebilirsin.";
      f.appendChild(note);
      codesWrap = document.createElement("div"); codesWrap.id = "tbCodes";
      codesWrap.appendChild(codeRow(true));
      addBtn = document.createElement("button");
      addBtn.type = "button"; addBtn.className = "tb-add"; addBtn.textContent = "+ Başka kod ekle";
      addBtn.onclick = function () { codesWrap.appendChild(codeRow(false)); };
      f.appendChild(codesWrap); f.appendChild(addBtn);
    }

    var rest = document.createElement("div"); rest.className = "tb-field";
    rest.innerHTML =
      '<input id="tbName" placeholder="IBAN sahibi ad soyad" autocomplete="off">' +
      '<input id="tbIban" placeholder="IBAN (TR...)" autocomplete="off">' +
      '<input id="tbWa" placeholder="WhatsApp numaran (5xx...)" inputmode="numeric" autocomplete="off">' +
      '<button id="tbSend">Siparişi oluştur</button>';
    f.appendChild(rest);

    var err = document.createElement("div"); err.className = "tb-err";
    actions.appendChild(f); actions.appendChild(err);

    rest.querySelector("#tbSend").onclick = function () {
      err.textContent = "";
      var payload = { service: service };
      if (service === "razer") {
        var codes = [];
        var rows = codesWrap.querySelectorAll(".tb-coderow");
        for (var i = 0; i < rows.length; i++) {
          var code = (rows[i].querySelector(".tb-code").value || "").trim();
          var amt = (rows[i].querySelector(".tb-amt").value || "").replace(/[^\d]/g, "");
          if (code.replace(/[\s-]/g, "").length < 10) { err.textContent = (i + 1) + ". kodu kontrol et."; return; }
          if (!amt || parseInt(amt, 10) <= 0) { err.textContent = (i + 1) + ". kodun TL değerini yaz."; return; }
          codes.push({ code: code, amountTry: amt });
        }
        if (!codes.length) { err.textContent = "En az bir kod gir."; return; }
        payload.codes = codes;
      }
      payload.name = (rest.querySelector("#tbName").value || "").trim();
      if (payload.name.replace(/\s+/g, " ").length < 3 || !/\s/.test(payload.name.trim())) { err.textContent = "IBAN sahibinin ad ve soyadını yaz."; return; }
      payload.iban = (rest.querySelector("#tbIban").value || "").trim();
      payload.whatsapp = (rest.querySelector("#tbWa").value || "").trim();
      if (!/^TR/i.test(payload.iban.replace(/\s+/g, ""))) { err.textContent = "IBAN TR ile başlamalı."; return; }
      if (payload.whatsapp.replace(/\D/g, "").length < 10) { err.textContent = "WhatsApp numaranı kontrol et."; return; }

      rest.querySelector("#tbSend").disabled = true;
      me(service === "razer" ? (payload.codes.length + " kod + IBAN gönderildi") : "iTunes sipariş bilgileri gönderildi");
      fetch(WORKER_URL + "/api/order", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      }).then(function (r) { return r.json(); }).then(function (d) {
        clearActions();
        if (d.ok) {
          // Sipariş panele yazıldı; otomatik doğrulama yok, sabah elle kontrol edilir.
          done(d.message);
          setTimeout(home, 3500);
        } else { bot("⚠️ " + (d.error || "Bir sorun oldu, lütfen WhatsApp'tan yaz.")); setTimeout(home, 700); }
      }).catch(function () {
        clearActions();
        bot("Bağlantı kurulamadı. Lütfen WhatsApp'tan yazar mısın?");
        setTimeout(menuServices, 600);
      });
    };
  }

  // Sipariş sonucu balonu (vurgulu)
  function done(text) {
    var d = document.createElement("div"); d.className = "tb-done"; d.textContent = text;
    body.appendChild(d); body.scrollTop = body.scrollHeight;
  }

  // ---- durum ----
  function loadStatus() {
    fetch(WORKER_URL + "/api/status").then(function (r) { return r.json(); }).then(function (d) {
      night = !!d.night;
      if (d.rates) RATES = d.rates;
      if (night) { sub.textContent = "Mesai dışı — gece sıraya alma açık"; dot.className = "tb-bot-dot night"; }
      else { sub.textContent = "Çevrimiçi • 10:00–03:00"; dot.className = "tb-bot-dot"; }
    }).catch(function () { sub.textContent = "WhatsApp: 0543 887 21 71"; });
  }

  var greeted = false;
  function open() {
    panel.classList.add("open");
    if (!greeted) {
      greeted = true;
      bot("Merhaba! 🐊 TimsahBozum destek botu. Sana nasıl yardımcı olabilirim?");
      home();
    }
  }
  btn.onclick = function () { panel.classList.contains("open") ? panel.classList.remove("open") : open(); };
  panel.querySelector(".tb-bot-x").onclick = function () { panel.classList.remove("open"); };

  loadStatus();
  setInterval(loadStatus, 5 * 60 * 1000);
})();
