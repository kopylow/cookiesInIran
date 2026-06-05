// Support / donation drawer — exposed as window.SupportUI.
// Loaded as a plain script (no ES modules) to match main.js / audiobook.js / comments.js.
//
// Pure frontend, no server component: the donation total is read from the static
// donations.json (edited weekly and pushed), and every payment method is a plain
// outbound link or a copyable address + a self-hosted QR image. Nothing is sent or
// stored — that is why no API/D1 and no CSP change are needed.
(function () {
  "use strict";

  const DONATIONS_URL = "donations.json";

  // ---------------------------------------------------------------------------
  // EDIT THESE before deploying. The QR images are generated separately by
  // build_support_qr.py — when you change an address/link here, change it there
  // too and re-run that script, or the visible value and its QR will disagree.
  // Amazon links are per market; RU has no store, so it falls back to .com/.de.
  // ---------------------------------------------------------------------------
  const PAYMENTS = {
    revolut: {
      url: "https://revolut.me/REPLACE_ME",
      iban: "DE00 0000 0000 0000 0000 00",
      qr: "support/qr/revolut.svg",
    },
    paypal: {
      url: "https://paypal.me/REPLACE_ME",
      presets: [25, 50, 100],
      qr: "support/qr/paypal.svg",
    },
    crypto: [
      { key: "btc", label: "Bitcoin", symbol: "₿", address: "REPLACE_ME_BTC_ADDRESS", qr: "support/qr/btc.svg" },
      { key: "eth", label: "Ethereum", symbol: "Ξ", address: "REPLACE_ME_ETH_ADDRESS", qr: "support/qr/eth.svg" },
      { key: "sol", label: "Solana", symbol: "◎", address: "REPLACE_ME_SOL_ADDRESS", qr: "support/qr/sol.svg" },
    ],
    amazon: {
      de: { print: "https://www.amazon.de/dp/REPLACE_ME" },
      en: { print: "https://www.amazon.com/dp/REPLACE_ME" },
      ru: { print: "https://www.amazon.com/dp/REPLACE_ME" },
    },
    // Free PDF, served same-origin from web-landing-page/pdf/.
    pdf: {
      de: "pdf/Kekse_im_Iran.pdf",
      en: "pdf/Cookies_in_Iran.pdf",
      ru: "pdf/Печенье_в_Иране.pdf",
    },
  };

  // Official brand marks (single-path, monochrome) from simple-icons, rendered
  // inline so they inherit the badge's white `color` via fill="currentColor".
  // Vector + no emoji = identical on every platform (see styles.css badge note).
  const LOGOS = {
    revolut:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z"/></svg>',
    paypal:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></svg>',
    btc:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"/></svg>',
    eth:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>',
    sol:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m23.8764 18.0313-3.962 4.1393a.9201.9201 0 0 1-.306.2106.9407.9407 0 0 1-.367.0742H.4599a.4689.4689 0 0 1-.2522-.0733.4513.4513 0 0 1-.1696-.1962.4375.4375 0 0 1-.0314-.2545.4438.4438 0 0 1 .117-.2298l3.9649-4.1393a.92.92 0 0 1 .3052-.2102.9407.9407 0 0 1 .3658-.0746H23.54a.4692.4692 0 0 1 .2523.0734.4531.4531 0 0 1 .1697.196.438.438 0 0 1 .0313.2547.4442.4442 0 0 1-.1169.2297zm-3.962-8.3355a.9202.9202 0 0 0-.306-.2106.941.941 0 0 0-.367-.0742H.4599a.4687.4687 0 0 0-.2522.0734.4513.4513 0 0 0-.1696.1961.4376.4376 0 0 0-.0314.2546.444.444 0 0 0 .117.2297l3.9649 4.1394a.9204.9204 0 0 0 .3052.2102c.1154.049.24.0744.3658.0746H23.54a.469.469 0 0 0 .2523-.0734.453.453 0 0 0 .1697-.1961.4382.4382 0 0 0 .0313-.2546.4444.4444 0 0 0-.1169-.2297zM.46 6.7225h18.7815a.9411.9411 0 0 0 .367-.0742.9202.9202 0 0 0 .306-.2106l3.962-4.1394a.4442.4442 0 0 0 .117-.2297.4378.4378 0 0 0-.0314-.2546.453.453 0 0 0-.1697-.196.469.469 0 0 0-.2523-.0734H4.7596a.941.941 0 0 0-.3658.0745.9203.9203 0 0 0-.3052.2102L.1246 5.9687a.4438.4438 0 0 0-.1169.2295.4375.4375 0 0 0 .0312.2544.4512.4512 0 0 0 .1692.196.4689.4689 0 0 0 .2518.0739z"/></svg>',
  };

  const LOCALE = { de: "de-DE", en: "en-US", ru: "ru-RU" };

  const I18N = {
    de: {
      heading: "Die Rettung meines W124 unterstützen",
      intro: "Wie ihr euch sicherlich vorstellen könnt, hat mich diese ganze Geschichte eine ganze Stange Geld gekostet: Gericht, Anwalt, Übersetzer, Kaution, Hotels und Flüge summieren sich erschreckend schnell. Mein W124, mein treuer Panzer aus Stahl, der mich durch so viele Länder getragen hat, steckt bis heute im Iran fest. Dieses Buch ist mein Versuch, aus dem ganzen Schlamassel doch noch etwas Gutes zu machen. Wenn euch die Geschichte berührt hat, bedeutet mir jede Unterstützung unglaublich viel.",
      ask: "Ich freue mich über jede Spende zwischen 5 und 5000 Euro, ganz so, wie es für euch passt. 5000 sind natürlich eine Ansage, aber falls ihr gerade reich geerbt habt oder einfach gut drauf seid: Ich halte tapfer die Hand auf. Und keine Sorge, das Geld versickert nicht komplett bei mir. Mit Payam, dem Mann, der mich aus diesem ganzen Schlamassel gezogen hat, habe ich abgemacht, dass er die Hälfte bekommt. Ohne ihn würde ich diese Zeilen vermutlich aus einer iranischen Zelle tippen, und das wäre für uns alle deutlich unbequemer. Und falls eure Taschen gerade leer sind, ist das überhaupt kein Problem: Wenn ihr jemand seid, oder jemanden kennt, der jemanden kennt, der meiner Geschichte etwas mehr Reichweite geben könnte (Presse, Podcast, Social Media oder einfach ein Mensch mit großem Megafon), dann ist mir das mindestens genauso viel wert wie eine Spende.",
      contact: "Schreibt mir gerne euren Kontakt in den Verwendungszweck (Telefon, E-Mail oder Instagram). Ich bedanke mich wirklich gern persönlich bei euch, auch wenn ein Keks per Post leider schwer zu verschicken ist.",
      standHeading: "Spendenstand",
      standOf: (r, g) => `${r} von ${g}`,
      standUpdated: (d) => `Stand: ${d}`,
      standNote: "Wird jeden Montag aktualisiert.",
      buyHeading: "Das Buch",
      buyNote: "Das PDF stelle ich euch kostenlos zur Verfügung: einfach herunterladen und lesen. Wer es lieber in der Hand hält, kann es bei Amazon als gedrucktes Buch bestellen. Daran verdiene ich allerdings nur wenig: wenn ihr mich wirklich unterstützen wollt, hilft mir eine Spende deutlich mehr.",
      buyPdf: "PDF kostenlos laden",
      buyPrint: "Als gedrucktes Buch (Amazon)",
      directHeading: "Direkt unterstützen",
      cryptoHeading: "Krypto",
      payWith: (n) => `Mit ${n} bezahlen`,
      ibanLabel: "IBAN",
      showQr: "QR anzeigen",
      hideQr: "QR ausblenden",
      copy: "Kopieren",
      copied: "Kopiert!",
    },
    en: {
      heading: "Help me rescue my W124",
      intro: "As you can probably imagine, this whole story cost me a serious amount of money: court, lawyer, translators, bail, hotels and flights add up frighteningly fast. My loyal W124, my steel tank that carried me through so many countries, is still stuck in Iran to this day. This book is my attempt to turn the whole mess into something good after all. If the story moved you, every bit of support means the world to me.",
      ask: "I would be grateful for any donation between 5 and 5000 euros, whatever feels right for you. 5000 is obviously a bold number, but if you happen to have no idea what to do with your money: I am bravely holding out my hand. And to keep things fair, I have agreed with Payam that he gets half, after all he is the one who got me out of there.",
      contact: "Feel free to drop your contact (phone, email or Instagram) in the payment reference. I would genuinely love to thank you in person, even if a cookie is hard to send by mail.",
      standHeading: "Donations so far",
      standOf: (r, g) => `${r} of ${g}`,
      standUpdated: (d) => `As of: ${d}`,
      standNote: "Updated every Monday.",
      buyHeading: "The book",
      buyNote: "The PDF is free: just download it and read. If you would rather hold it in your hands, you can order a printed copy on Amazon. I earn very little from that, though: if you really want to support me, a donation helps far more.",
      buyPdf: "Download PDF (free)",
      buyPrint: "Printed book (Amazon)",
      directHeading: "Support directly",
      cryptoHeading: "Crypto",
      payWith: (n) => `Pay with ${n}`,
      ibanLabel: "IBAN",
      showQr: "Show QR",
      hideQr: "Hide QR",
      copy: "Copy",
      copied: "Copied!",
    },
    ru: {
      heading: "Помочь вызволить мой W124",
      intro: "Как вы наверняка можете себе представить, вся эта история обошлась мне в круглую сумму: суд, адвокат, переводчики, залог, гостиницы и перелёты складываются пугающе быстро. Мой верный W124, мой стальной танк, что провёз меня через столько стран, до сих пор застрял в Иране. Эта книга: моя попытка превратить весь этот хаос во что-то хорошее. Если история вас тронула, для меня бесконечно много значит любая поддержка.",
      ask: "Я буду рад любому пожертвованию от 5 до 5000 евро, насколько вам комфортно. 5000, конечно, серьёзная заявка, но если вы вдруг не знаете, куда деть деньги: я мужественно подставляю ладонь. И чтобы всё было по-честному, я договорился с Паямом, что половину он забирает себе, ведь именно он меня оттуда вытащил.",
      contact: "В назначении платежа вы можете оставить свой контакт (телефон, e-mail или Instagram). Мне правда хочется поблагодарить вас лично, хотя печенье по почте, увы, не отправишь.",
      standHeading: "Собрано на данный момент",
      standOf: (r, g) => `${r} из ${g}`,
      standUpdated: (d) => `По состоянию на: ${d}`,
      standNote: "Обновляется каждый понедельник.",
      buyHeading: "Книга",
      buyNote: "PDF я выкладываю бесплатно: просто скачайте и читайте. Если хочется держать книгу в руках, её можно заказать в печатном виде на Amazon. На этом я зарабатываю совсем немного: если вы правда хотите меня поддержать, пожертвование помогает гораздо больше.",
      buyPdf: "Скачать PDF (бесплатно)",
      buyPrint: "Печатная книга (Amazon)",
      directHeading: "Поддержать напрямую",
      cryptoHeading: "Криптовалюта",
      payWith: (n) => `Оплатить через ${n}`,
      ibanLabel: "IBAN",
      showQr: "Показать QR",
      hideQr: "Скрыть QR",
      copy: "Копировать",
      copied: "Скопировано!",
    },
  };

  // --- module state ---
  let contentEl = null; // .drawer-content of #drawer-support
  let currentLang = "de";
  let getLang = () => currentLang;
  let donations = null;
  let openQr = null; // the single currently-expanded .support-qr block (accordion)

  function t() {
    return I18N[currentLang] || I18N.en;
  }

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function money(amount) {
    const cur = (donations && donations.currency) || "EUR";
    try {
      return new Intl.NumberFormat(LOCALE[currentLang] || "en-US", {
        style: "currency",
        currency: cur,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (e) {
      return `${amount} ${cur}`;
    }
  }

  // Copy-to-clipboard with transient "Copied!" feedback on the button.
  function attachCopy(btn, value) {
    btn.addEventListener("click", () => {
      const restore = btn.textContent;
      const done = () => {
        btn.textContent = t().copied;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = restore;
          btn.classList.remove("copied");
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(() => {});
      } else {
        // Fallback for older / insecure contexts.
        const ta = el("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  // A "QR anzeigen" toggle + a collapsed QR image. Accordion: opening one closes
  // any other, so the screen never shows more than a single QR (phones get
  // confused by multiple codes in view).
  function qrToggle(src, alt) {
    const wrap = el("div", { class: "support-qr-wrap" });
    const btn = el("button", { class: "support-qr-toggle", type: "button", "aria-expanded": "false" }, t().showQr);
    const panel = el("div", { class: "support-qr" });
    const img = el("img", { src: src, alt: alt, loading: "lazy", width: "220", height: "220" });
    panel.appendChild(img);

    function close() {
      panel.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = t().showQr;
      if (openQr === panel) openQr = null;
    }
    function open() {
      if (openQr && openQr !== panel) {
        // collapse the previously open QR
        openQr._close && openQr._close();
      }
      panel.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = t().hideQr;
      openQr = panel;
    }
    panel._close = close;
    btn.addEventListener("click", () => {
      if (panel.classList.contains("open")) close();
      else open();
    });

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    return wrap;
  }

  function linkButton(href, label, extraClass) {
    return el(
      "a",
      { class: "support-btn" + (extraClass ? " " + extraClass : ""), href: href, target: "_blank", rel: "noopener" },
      label
    );
  }

  // A labelled group of cards (e.g. "Direct support", "Crypto"). Returns the
  // <section> with an empty .support-cards grid exposed as ._grid to fill.
  function group(labelText) {
    const sec = el("section", { class: "support-group" });
    sec.appendChild(el("h3", { class: "support-group-label" }, labelText));
    const grid = el("div", { class: "support-cards" });
    sec.appendChild(grid);
    sec._grid = grid;
    return sec;
  }

  // A payment-method card: branded badge + title in the head, an empty body
  // exposed as ._body for the caller to fill (buttons, copy rows, QR).
  function methodCard(badgeGlyph, badgeMod, title, subtitle) {
    const card = el("section", { class: "support-card" });
    const head = el("div", { class: "support-card-head" });
    if (badgeGlyph) {
      const badge = el("span", { class: "support-badge support-badge--" + badgeMod, "aria-hidden": "true" });
      // SVG brand marks render inline (so they inherit the badge's white fill);
      // plain glyphs (e.g. the book "★") stay as text content.
      if (typeof badgeGlyph === "string" && badgeGlyph.charAt(0) === "<") {
        badge.classList.add("support-badge--logo");
        badge.innerHTML = badgeGlyph;
      } else {
        badge.textContent = badgeGlyph;
      }
      head.appendChild(badge);
    }
    const titles = el("div", { class: "support-card-titles" });
    titles.appendChild(el("h4", { class: "support-card-title" }, title));
    if (subtitle) titles.appendChild(el("p", { class: "support-card-sub" }, subtitle));
    head.appendChild(titles);
    card.appendChild(head);
    const body = el("div", { class: "support-card-body" });
    card.appendChild(body);
    card._body = body;
    return card;
  }

  function render() {
    if (!contentEl) return;
    openQr = null;
    contentEl.innerHTML = "";
    const tr = t();

    const root = el("div", { class: "support" });

    // --- HERO: the pitch (left) + a prominent donation meter (right) ---
    const hero = el("header", { class: "support-hero" });
    const pitch = el("div", { class: "support-hero-text" });
    pitch.appendChild(el("h2", { class: "support-title" }, tr.heading));
    pitch.appendChild(el("p", { class: "support-lead" }, tr.intro));
    pitch.appendChild(el("p", { class: "support-ask" }, tr.ask));
    pitch.appendChild(el("p", { class: "support-contact" }, tr.contact));
    hero.appendChild(pitch);

    // Donation meter (skip gracefully if donations.json failed to load)
    if (donations && typeof donations.raised === "number" && typeof donations.goal === "number") {
      const pct = donations.goal > 0 ? Math.min(100, (donations.raised / donations.goal) * 100) : 0;
      const meter = el("aside", { class: "support-meter" });
      meter.appendChild(el("span", { class: "support-meter-label" }, tr.standHeading));
      meter.appendChild(el("span", { class: "support-meter-amount" }, money(donations.raised)));
      const bar = el("div", { class: "support-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(donations.goal), "aria-valuenow": String(donations.raised) });
      const fill = el("div", { class: "support-bar-fill" });
      fill.style.width = pct.toFixed(1) + "%";
      bar.appendChild(fill);
      meter.appendChild(bar);
      meter.appendChild(el("span", { class: "support-meter-goal" }, tr.standOf(money(donations.raised), money(donations.goal))));
      const meta = el("p", { class: "support-meter-meta" });
      if (donations.updated) meta.appendChild(el("span", null, tr.standUpdated(donations.updated)));
      meta.appendChild(el("span", { class: "support-stand-note" }, tr.standNote));
      meter.appendChild(meta);
      hero.appendChild(meter);
      hero.classList.add("has-meter");
    }
    root.appendChild(hero);

    // --- FEATURE: buying the book is the easiest help (full-width, accented) ---
    const az = PAYMENTS.amazon[currentLang] || PAYMENTS.amazon.en;
    const feat = methodCard("★", "book", tr.buyHeading, tr.buyNote);
    feat.classList.add("support-card--feature");
    const buyRow = el("div", { class: "support-btn-row" });
    if (az && az.print) buyRow.appendChild(linkButton(az.print, tr.buyPrint, "primary"));
    if (az && az.kindle) buyRow.appendChild(linkButton(az.kindle, tr.buyKindle));
    feat._body.appendChild(buyRow);
    root.appendChild(feat);

    // --- DIRECT SUPPORT: Revolut + PayPal as side-by-side cards ---
    const direct = group(tr.directHeading);

    const rev = methodCard(LOGOS.revolut, "revolut", "Revolut");
    rev._body.appendChild(linkButton(PAYMENTS.revolut.url, tr.payWith("Revolut"), "primary full"));
    const ibanRow = el("div", { class: "support-copy-row" });
    ibanRow.appendChild(el("span", { class: "support-copy-label" }, tr.ibanLabel));
    ibanRow.appendChild(el("code", { class: "support-copy-val" }, PAYMENTS.revolut.iban));
    const ibanCopy = el("button", { class: "support-copy-btn", type: "button" }, tr.copy);
    attachCopy(ibanCopy, PAYMENTS.revolut.iban.replace(/\s+/g, ""));
    ibanRow.appendChild(ibanCopy);
    rev._body.appendChild(ibanRow);
    rev._body.appendChild(qrToggle(PAYMENTS.revolut.qr, "Revolut QR"));
    direct._grid.appendChild(rev);

    const pp = methodCard(LOGOS.paypal, "paypal", "PayPal");
    pp._body.appendChild(linkButton(PAYMENTS.paypal.url, tr.payWith("PayPal"), "primary full"));
    if (Array.isArray(PAYMENTS.paypal.presets) && PAYMENTS.paypal.presets.length) {
      const presets = el("div", { class: "support-presets" });
      PAYMENTS.paypal.presets.forEach((amt) => {
        presets.appendChild(linkButton(`${PAYMENTS.paypal.url}/${amt}`, money(amt), "preset"));
      });
      pp._body.appendChild(presets);
    }
    pp._body.appendChild(qrToggle(PAYMENTS.paypal.qr, "PayPal QR"));
    direct._grid.appendChild(pp);
    root.appendChild(direct);

    // --- CRYPTO: one card per coin, branded badge ---
    const crypto = group(tr.cryptoHeading);
    PAYMENTS.crypto.forEach((c) => {
      const card = methodCard(LOGOS[c.key] || c.symbol, c.key, c.label);
      const row = el("div", { class: "support-copy-row" });
      row.appendChild(el("code", { class: "support-copy-val support-addr" }, c.address));
      const copy = el("button", { class: "support-copy-btn", type: "button" }, tr.copy);
      attachCopy(copy, c.address);
      row.appendChild(copy);
      card._body.appendChild(row);
      card._body.appendChild(qrToggle(c.qr, `${c.label} QR`));
      crypto._grid.appendChild(card);
    });
    root.appendChild(crypto);

    contentEl.appendChild(root);
  }

  async function loadDonations() {
    try {
      const res = await fetch(DONATIONS_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("donations " + res.status);
      donations = await res.json();
    } catch (e) {
      donations = null; // bar is skipped; the rest of the drawer still renders
    }
  }

  // --- public API (mirrors window.AudioPlayer / window.CommentsUI) ---
  const SupportUI = {
    init(opts) {
      opts = opts || {};
      contentEl = opts.contentEl || (opts.drawerEl && opts.drawerEl.querySelector(".drawer-content")) || null;
      getLang = opts.getCurrentLang || getLang;
      currentLang = getLang();
    },
    async open() {
      currentLang = getLang();
      await loadDonations();
      render();
    },
    setLang(lang) {
      currentLang = lang;
      render();
    },
  };

  window.SupportUI = SupportUI;
})();
