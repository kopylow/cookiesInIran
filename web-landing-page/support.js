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
      de: { print: "https://www.amazon.de/dp/REPLACE_ME", kindle: "https://www.amazon.de/dp/REPLACE_ME_KINDLE" },
      en: { print: "https://www.amazon.com/dp/REPLACE_ME", kindle: "https://www.amazon.com/dp/REPLACE_ME_KINDLE" },
      ru: { print: "https://www.amazon.com/dp/REPLACE_ME", kindle: "https://www.amazon.com/dp/REPLACE_ME_KINDLE" },
    },
  };

  const LOCALE = { de: "de-DE", en: "en-US", ru: "ru-RU" };

  const I18N = {
    de: {
      heading: "Dieses Projekt unterstützen",
      intro: "Dieses Buch und die ganze Geschichte dahinter haben mich viel gekostet: Gericht, Anwalt, Übersetzer, Hotels und Flüge summieren sich schnell. Wenn dich die Geschichte berührt hat, freue ich mich sehr über jede Unterstützung.",
      ask: "Ich bitte um eine Spende zwischen 5 und 5000 Euro, ganz so, wie es für dich passt.",
      contact: "Hinterlasse im Verwendungszweck gerne deinen Kontakt (Telefon, E-Mail oder Instagram), damit ich mich persönlich bei dir bedanken kann.",
      standHeading: "Spendenstand",
      standOf: (r, g) => `${r} von ${g}`,
      standUpdated: (d) => `Stand: ${d}`,
      standNote: "Wird jeden Montag aktualisiert.",
      buyHeading: "Buch kaufen",
      buyNote: "Das Buch zu kaufen ist die einfachste Art zu helfen: Du bekommst etwas und ich erhalte knapp 4 Euro pro Exemplar.",
      buyPrint: "Als Buch (Amazon)",
      buyKindle: "Als Kindle (Amazon)",
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
      heading: "Support this project",
      intro: "This book and the whole story behind it cost me a lot: court, lawyer, translators, hotels and flights add up fast. If the story moved you, any support is hugely appreciated.",
      ask: "I am asking for a donation between 5 and 5000 euros, whatever feels right for you.",
      contact: "Feel free to leave your contact (phone, email or Instagram) in the payment reference, so I can thank you personally.",
      standHeading: "Donations so far",
      standOf: (r, g) => `${r} of ${g}`,
      standUpdated: (d) => `As of: ${d}`,
      standNote: "Updated every Monday.",
      buyHeading: "Buy the book",
      buyNote: "Buying the book is the easiest way to help: you get something, and I earn almost 4 per copy.",
      buyPrint: "Paperback (Amazon)",
      buyKindle: "Kindle (Amazon)",
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
      heading: "Поддержать проект",
      intro: "Эта книга и вся история за ней дорого мне обошлись: суд, адвокат, переводчики, гостиницы и перелёты быстро складываются в крупную сумму. Если история вас тронула, я буду благодарен любой поддержке.",
      ask: "Прошу о пожертвовании от 5 до 5000 евро, насколько вам комфортно.",
      contact: "В назначении платежа вы можете оставить свой контакт (телефон, e-mail или Instagram), чтобы я мог поблагодарить вас лично.",
      standHeading: "Собрано на данный момент",
      standOf: (r, g) => `${r} из ${g}`,
      standUpdated: (d) => `По состоянию на: ${d}`,
      standNote: "Обновляется каждый понедельник.",
      buyHeading: "Купить книгу",
      buyNote: "Купить книгу: самый простой способ помочь. Вы получаете книгу, а я зарабатываю почти 4 за экземпляр.",
      buyPrint: "Печатная книга (Amazon)",
      buyKindle: "Kindle (Amazon)",
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
      head.appendChild(el("span", { class: "support-badge support-badge--" + badgeMod, "aria-hidden": "true" }, badgeGlyph));
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

    const rev = methodCard("R", "revolut", "Revolut");
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

    const pp = methodCard("P", "paypal", "PayPal");
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
      const card = methodCard(c.symbol, c.key, c.label);
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
