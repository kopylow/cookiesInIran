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
      url: "https://revolut.me/kopylow",
      // Recipient name: required by virtually every banking app, and matched by the
      // EU-mandatory Verification of Payee check, so it must equal the account holder.
      holder: "Anton Kopylow",
      iban: "DE22 1001 0178 1371 5785 20",
      // BIC is optional for SEPA (IBAN-only since 2016); only non-SEPA/international
      // senders need it. Leave "" to hide the row.
      bic: "REVODEB2",
      qr: "support/qr/revolut.svg",
    },
    paypal: {
      url: "https://paypal.me/kopylow",
      presets: [25, 50, 100],
      qr: "support/qr/paypal.svg",
    },
    crypto: [
      // BTC has two receive formats. Both are shown (labelled) in the modal; the
      // QR encodes the Native SegWit one for the widest sender compatibility.
      { key: "btc", label: "Bitcoin", symbol: "₿", qr: "support/qr/btc.svg",
        addresses: [
          { label: "Taproot", address: "bc1p59dgjxy6u8pgvmchdhnmeu4swsfc7nvvw393te56kczadtx63kfssy4xqe" },
          { label: "Native SegWit", address: "bc1qlmzpu3neanphpwpl7m0edqevfy45340sutq37j" },
        ] },
      { key: "eth", label: "Ethereum", symbol: "Ξ", address: "0x1C8A2d42a66DF41C3a0467D659f23d6f8b8A59b2", qr: "support/qr/eth.svg" },
      { key: "sol", label: "Solana", symbol: "◎", address: "7gf3oeu38riHM2g8rTtuFYw6vUeEFDQbkVjTVVwDd8no", qr: "support/qr/sol.svg" },
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
    // Generic bank/"account balance" mark for the SEPA bank-transfer card.
    bank:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 10h3v7H4v-7zm6.5 0h3v7h-3v-7zM2 19h19v3H2v-3zm15-9h3v7h-3v-7zm-5.5-9L2 6v2h19V6l-9.5-5z"/></svg>',
    btc:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"/></svg>',
    eth:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>',
    sol:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m23.8764 18.0313-3.962 4.1393a.9201.9201 0 0 1-.306.2106.9407.9407 0 0 1-.367.0742H.4599a.4689.4689 0 0 1-.2522-.0733.4513.4513 0 0 1-.1696-.1962.4375.4375 0 0 1-.0314-.2545.4438.4438 0 0 1 .117-.2298l3.9649-4.1393a.92.92 0 0 1 .3052-.2102.9407.9407 0 0 1 .3658-.0746H23.54a.4692.4692 0 0 1 .2523.0734.4531.4531 0 0 1 .1697.196.438.438 0 0 1 .0313.2547.4442.4442 0 0 1-.1169.2297zm-3.962-8.3355a.9202.9202 0 0 0-.306-.2106.941.941 0 0 0-.367-.0742H.4599a.4687.4687 0 0 0-.2522.0734.4513.4513 0 0 0-.1696.1961.4376.4376 0 0 0-.0314.2546.444.444 0 0 0 .117.2297l3.9649 4.1394a.9204.9204 0 0 0 .3052.2102c.1154.049.24.0744.3658.0746H23.54a.469.469 0 0 0 .2523-.0734.453.453 0 0 0 .1697-.1961.4382.4382 0 0 0 .0313-.2546.4444.4444 0 0 0-.1169-.2297zM.46 6.7225h18.7815a.9411.9411 0 0 0 .367-.0742.9202.9202 0 0 0 .306-.2106l3.962-4.1394a.4442.4442 0 0 0 .117-.2297.4378.4378 0 0 0-.0314-.2546.453.453 0 0 0-.1697-.196.469.469 0 0 0-.2523-.0734H4.7596a.941.941 0 0 0-.3658.0745.9203.9203 0 0 0-.3052.2102L.1246 5.9687a.4438.4438 0 0 0-.1169.2295.4375.4375 0 0 0 .0312.2544.4512.4512 0 0 0 .1692.196.4689.4689 0 0 0 .2518.0739z"/></svg>',
  };

  // Small payment-acceptance marks (not brand badges): shown after a method's
  // title to signal what that method ultimately accepts. The Revolut hosted
  // checkout (revolut.me) takes credit/debit card + Apple Pay with no Revolut
  // account, so we surface those marks behind the "Revolut" label. Single-path,
  // inherit `currentColor` like LOGOS. `applepay` is the official simple-icons
  // mark; `card` is the standard Material credit-card glyph.
  const MARKS = {
    card:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>',
    applepay:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.15 4.318a42.16 42.16 0 0 0-.454.003c-.15.005-.303.013-.452.04a1.44 1.44 0 0 0-1.06.772c-.07.138-.114.278-.14.43-.028.148-.037.3-.04.45A10.2 10.2 0 0 0 0 6.222v11.557c0 .07.002.138.003.207.004.15.013.303.04.452.027.15.072.291.142.429a1.436 1.436 0 0 0 .63.63c.138.07.278.115.43.142.148.027.3.036.45.04l.208.003h20.194l.207-.003c.15-.004.303-.013.452-.04.15-.027.291-.071.428-.141a1.432 1.432 0 0 0 .631-.631c.07-.138.115-.278.141-.43.027-.148.036-.3.04-.45.002-.07.003-.138.003-.208l.001-.246V6.221c0-.07-.002-.138-.004-.207a2.995 2.995 0 0 0-.04-.452 1.446 1.446 0 0 0-1.2-1.201 3.022 3.022 0 0 0-.452-.04 10.448 10.448 0 0 0-.453-.003zm0 .512h19.942c.066 0 .131.002.197.003.115.004.25.01.375.032.109.02.2.05.287.094a.927.927 0 0 1 .407.407.997.997 0 0 1 .094.288c.022.123.028.258.031.374.002.065.003.13.003.197v11.552c0 .065 0 .13-.003.196-.003.115-.009.25-.032.375a.927.927 0 0 1-.5.693 1.002 1.002 0 0 1-.286.094 2.598 2.598 0 0 1-.373.032l-.2.003H1.906c-.066 0-.133-.002-.196-.003a2.61 2.61 0 0 1-.375-.032c-.109-.02-.2-.05-.288-.094a.918.918 0 0 1-.406-.407 1.006 1.006 0 0 1-.094-.288 2.531 2.531 0 0 1-.032-.373 9.588 9.588 0 0 1-.002-.197V6.224c0-.065 0-.131.002-.197.004-.114.01-.248.032-.375.02-.108.05-.199.094-.287a.925.925 0 0 1 .407-.406 1.03 1.03 0 0 1 .287-.094c.125-.022.26-.029.375-.032.065-.002.131-.002.196-.003zm4.71 3.7c-.3.016-.668.199-.88.456-.191.22-.36.58-.316.918.338.03.675-.169.888-.418.205-.258.345-.603.308-.955zm2.207.42v5.493h.852v-1.877h1.18c1.078 0 1.835-.739 1.835-1.812 0-1.07-.742-1.805-1.808-1.805zm.852.719h.982c.739 0 1.161.396 1.161 1.089 0 .692-.422 1.092-1.164 1.092h-.979zm-3.154.3c-.45.01-.83.28-1.05.28-.235 0-.593-.264-.981-.257a1.446 1.446 0 0 0-1.23.747c-.527.908-.139 2.255.374 2.995.249.366.549.769.944.754.373-.014.52-.242.973-.242.454 0 .586.242.98.235.41-.007.667-.366.915-.733.286-.417.403-.82.41-.841-.007-.008-.79-.308-.797-1.209-.008-.754.615-1.113.644-1.135-.352-.52-.9-.578-1.09-.593a1.123 1.123 0 0 0-.092-.002zm8.204.397c-.99 0-1.606.533-1.652 1.256h.777c.072-.358.369-.586.845-.586.502 0 .803.266.803.711v.309l-1.097.064c-.951.054-1.488.484-1.488 1.184 0 .72.548 1.207 1.332 1.207.526 0 1.032-.281 1.264-.727h.019v.659h.788v-2.76c0-.803-.62-1.317-1.591-1.317zm1.94.072l1.446 4.009c0 .003-.073.24-.073.247-.125.41-.33.571-.711.571-.069 0-.206 0-.267-.015v.666c.06.011.267.019.335.019.83 0 1.226-.312 1.568-1.283l1.5-4.214h-.868l-1.012 3.259h-.015l-1.013-3.26zm-1.167 2.189v.316c0 .521-.45.917-1.024.917-.442 0-.731-.228-.731-.579 0-.342.278-.56.769-.593z"/></svg>',
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
      buyPrint: "Gedrucktes Buch",
      printSoon: "Das gedruckte Buch sollte spätestens am Montag verfügbar sein.",
      directHeading: "Direkt unterstützen",
      cryptoHeading: "Krypto",
      payWith: (n) => `Mit ${n} spenden`,
      holderLabel: "Empfänger",
      ibanLabel: "IBAN",
      bicLabel: "BIC",
      showQr: "QR anzeigen",
      hideQr: "QR ausblenden",
      copy: "Kopieren",
      copied: "Kopiert!",
      closeLabel: "Schließen",
      acceptsCard: "Auch mit Kreditkarte und Apple Pay (kein Revolut-Konto nötig)",
      amountLabel: "Eigener Betrag in Euro",
      amountPlaceholder: "Betrag (€)",
      payCustom: "Spenden",
    },
    en: {
      heading: "Help me rescue my W124",
      intro: "As you can probably imagine, this whole story cost me a serious amount of money: court, lawyer, translators, bail, hotels and flights add up frighteningly fast. My loyal W124, my steel tank that carried me through so many countries, is still stuck in Iran to this day. This book is my attempt to turn the whole mess into something good after all. If the story moved you, every bit of support means the world to me.",
      ask: "I would be grateful for any donation between 5 and 5000 euros, whatever feels right for you. 5000 is quite a statement, of course, but in case you have just come into a rich inheritance or are simply in a generous mood: I am bravely holding out my hand. And don't worry, the money does not all vanish into my pockets. With Payam, the man who pulled me out of this whole mess, I have agreed that he gets half. Without him I would probably be typing these lines from an Iranian cell, and that would be considerably less comfortable for all of us. And if your pockets happen to be empty right now, that is no problem at all: if you are someone, or know someone who knows someone, who could give my story a bit more reach (press, podcast, social media or simply a person with a big megaphone), then that means at least as much to me as a donation.",
      contact: "Feel free to drop your contact (phone, email or Instagram) in the payment reference. I would genuinely love to thank you in person, even if a cookie is hard to send by mail.",
      standHeading: "Donations so far",
      standOf: (r, g) => `${r} of ${g}`,
      standUpdated: (d) => `As of: ${d}`,
      standNote: "Updated every Monday.",
      buyHeading: "The book",
      buyNote: "The PDF is free: just download it and read. If you would rather hold it in your hands, you can order a printed copy on Amazon. I earn very little from that, though: if you really want to support me, a donation helps far more.",
      buyPdf: "Download PDF (free)",
      buyPrint: "Printed book",
      printSoon: "The printed book should be available by Monday at the latest.",
      directHeading: "Support directly",
      cryptoHeading: "Crypto",
      payWith: (n) => `Donate with ${n}`,
      holderLabel: "Recipient",
      ibanLabel: "IBAN",
      bicLabel: "BIC",
      showQr: "Show QR",
      hideQr: "Hide QR",
      copy: "Copy",
      copied: "Copied!",
      closeLabel: "Close",
      acceptsCard: "Also with credit card and Apple Pay (no Revolut account needed)",
      amountLabel: "Custom amount in euros",
      amountPlaceholder: "Amount (€)",
      payCustom: "Donate",
    },
    ru: {
      heading: "Помочь вызволить мой W124",
      intro: "Как вы наверняка можете себе представить, вся эта история обошлась мне в круглую сумму: суд, адвокат, переводчики, залог, гостиницы и перелёты складываются пугающе быстро. Мой верный W124, мой стальной танк, что провёз меня через столько стран, до сих пор застрял в Иране. Эта книга: моя попытка превратить весь этот хаос во что-то хорошее. Если история вас тронула, для меня бесконечно много значит любая поддержка.",
      ask: "Я буду рад любому донату от 5 до 5000 евро, насколько вам комфортно. 5000, конечно, серьёзная заявка, но если вы вдруг получили богатое наследство или просто в хорошем настроении: я мужественно подставляю ладонь. И не переживайте, деньги не оседают целиком у меня. С Паямом, человеком, который вытащил меня из всей этой передряги, мы договорились, что половину получает он. Без него я, наверное, печатал бы эти строки из иранской камеры, а это было бы заметно неудобнее для всех нас. А если карманы у вас сейчас пусты, это вовсе не проблема: если вы тот человек, или знаете кого-то, кто знает кого-то, кто мог бы дать моей истории чуть больше охвата (пресса, подкаст, соцсети или просто человек с большим мегафоном), для меня это значит как минимум столько же, сколько донат.",
      contact: "В назначении платежа вы можете оставить свой контакт (телефон, e-mail или Instagram). Мне правда хочется поблагодарить вас лично, хотя печенье по почте, увы, не отправишь.",
      standHeading: "Собрано на данный момент",
      standOf: (r, g) => `${r} из ${g}`,
      standUpdated: (d) => `По состоянию на: ${d}`,
      standNote: "Обновляется каждый понедельник.",
      buyHeading: "Книга",
      buyNote: "PDF я выкладываю бесплатно: просто скачайте и читайте. Если хочется держать книгу в руках, её можно заказать в печатном виде на Amazon. На этом я зарабатываю совсем немного: если вы правда хотите меня поддержать, пожертвование помогает гораздо больше.",
      buyPdf: "Скачать PDF (бесплатно)",
      buyPrint: "Печатная книга",
      printSoon: "Печатная книга должна появиться не позднее понедельника.",
      directHeading: "Поддержать напрямую",
      cryptoHeading: "Криптовалюта",
      payWith: (n) => `Задонатить через ${n}`,
      holderLabel: "Получатель",
      ibanLabel: "IBAN",
      bicLabel: "BIC",
      showQr: "Показать QR",
      hideQr: "Скрыть QR",
      copy: "Копировать",
      copied: "Скопировано!",
      closeLabel: "Закрыть",
      acceptsCard: "Также картой и Apple Pay (счёт Revolut не нужен)",
      amountLabel: "Своя сумма в евро",
      amountPlaceholder: "Сумма (€)",
      payCustom: "Задонатить",
    },
  };

  // --- module state ---
  let contentEl = null; // .drawer-content of #drawer-support
  let currentLang = "de";
  let getLang = () => currentLang;
  let donations = null;

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

  // A label/value/copy row (recipient, IBAN, BIC, crypto address). `display` is
  // shown; `copyVal` is what lands on the clipboard (defaults to `display`) — the
  // IBAN copies without spaces so it pastes as a valid account number.
  function copyRow(label, display, copyVal) {
    const row = el("div", { class: "support-copy-row" });
    if (label) row.appendChild(el("span", { class: "support-copy-label" }, label));
    row.appendChild(el("code", { class: "support-copy-val" }, display));
    const btn = el("button", { class: "support-copy-btn", type: "button" }, t().copy);
    attachCopy(btn, copyVal != null ? copyVal : display);
    row.appendChild(btn);
    return row;
  }

  // A QR shown directly (no accordion) — it lives inside a single-method modal,
  // so there is never more than one code on screen and no toggle is needed.
  function modalQr(src, alt) {
    const wrap = el("div", { class: "support-modal-qr" });
    wrap.appendChild(el("img", { src: src, alt: alt, loading: "lazy", width: "220", height: "220" }));
    return wrap;
  }

  // Branded badge plate, reused by the trigger cards, the book card, and the
  // modal head. SVG marks render inline (inherit white fill); glyphs stay text.
  function makeBadge(badgeGlyph, badgeMod) {
    const badge = el("span", { class: "support-badge support-badge--" + badgeMod, "aria-hidden": "true" });
    if (typeof badgeGlyph === "string" && badgeGlyph.charAt(0) === "<") {
      badge.classList.add("support-badge--logo");
      badge.innerHTML = badgeGlyph;
    } else {
      badge.textContent = badgeGlyph;
    }
    return badge;
  }

  function linkButton(href, label, extraClass) {
    return el(
      "a",
      { class: "support-btn" + (extraClass ? " " + extraClass : ""), href: href, target: "_blank", rel: "noopener" },
      label
    );
  }

  // Free-entry amount field for PayPal.me: an input + a Pay button whose href is
  // rebuilt as the user types (paypal.me/<user>/<amount>). With no/zero amount it
  // falls back to the bare profile link so the button is never a dead end. Uses
  // type=text + inputmode=decimal (not type=number) so a comma decimal — the norm
  // in DE/RU — is preserved and normalised; non-positive input yields the profile
  // link. PayPal.me caps the amount itself, so we only sanity-check it is > 0.
  function amountField(baseUrl) {
    const tr = t();
    const row = el("div", { class: "support-amount" });
    const input = el("input", {
      type: "text", inputmode: "decimal", autocomplete: "off",
      class: "support-amount-input", placeholder: tr.amountPlaceholder, "aria-label": tr.amountLabel,
    });
    const pay = el("a", { class: "support-btn primary", href: baseUrl, target: "_blank", rel: "noopener" }, tr.payCustom);
    const sync = () => {
      const v = parseFloat((input.value || "").trim().replace(",", "."));
      pay.href = isFinite(v) && v > 0 ? `${baseUrl}/${v}` : baseUrl;
    };
    input.addEventListener("input", sync);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") pay.click(); });
    row.appendChild(input);
    row.appendChild(pay);
    return row;
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
    if (badgeGlyph) head.appendChild(makeBadge(badgeGlyph, badgeMod));
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

  // A method card that is itself the trigger: badge + title + chevron, no numbers
  // shown. Clicking it calls buildBody(modalBody) to fill the detail modal.
  // `marks` (optional): { glyphs: [svgString…], label } renders small
  // payment-acceptance icons under the title (e.g. card + Apple Pay for Revolut).
  function triggerCard(badgeGlyph, badgeMod, title, buildBody, marks) {
    const card = el("button", { class: "support-card support-card--trigger", type: "button" });
    const head = el("div", { class: "support-card-head" });
    if (badgeGlyph) head.appendChild(makeBadge(badgeGlyph, badgeMod));
    const titles = el("div", { class: "support-card-titles" });
    titles.appendChild(el("span", { class: "support-card-title" }, title));
    if (marks && Array.isArray(marks.glyphs) && marks.glyphs.length) {
      const row = el("span", { class: "support-card-marks", role: "img", "aria-label": marks.label || "" });
      marks.glyphs.forEach((g) => {
        const m = el("span", { class: "support-card-mark", "aria-hidden": "true" });
        m.innerHTML = g;
        row.appendChild(m);
      });
      titles.appendChild(row);
    }
    head.appendChild(titles);
    card.appendChild(head);
    card.appendChild(el("span", { class: "support-card-chevron", "aria-hidden": "true" }, "›"));
    card.addEventListener("click", () => openModal(badgeGlyph, badgeMod, title, buildBody));
    return card;
  }

  // --- payment-detail modal --------------------------------------------------
  // Methods no longer print IBANs / addresses inline; each card opens a focused
  // modal carrying the copyable details + QR. One modal at a time; closes on the
  // backdrop, the × button, or Escape, and restores focus to the trigger.
  let modalEl = null;
  let lastFocus = null;

  function closeModal() {
    if (!modalEl) return;
    document.removeEventListener("keydown", onModalKey);
    modalEl.remove();
    modalEl = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onModalKey(e) {
    if (e.key === "Escape") closeModal();
  }
  function openModal(badgeGlyph, badgeMod, title, buildBody) {
    closeModal();
    lastFocus = document.activeElement;
    const overlay = el("div", { class: "support-modal" });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
    const box = el("div", { class: "support-modal-box", role: "dialog", "aria-modal": "true", "aria-label": title });
    const head = el("div", { class: "support-modal-head" });
    if (badgeGlyph) head.appendChild(makeBadge(badgeGlyph, badgeMod));
    head.appendChild(el("h3", { class: "support-modal-title" }, title));
    const close = el("button", { class: "support-modal-close", type: "button", "aria-label": t().closeLabel }, "×");
    close.addEventListener("click", closeModal);
    head.appendChild(close);
    box.appendChild(head);
    const body = el("div", { class: "support-modal-body" });
    buildBody(body);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onModalKey);
    close.focus();
    modalEl = overlay;
  }

  function render() {
    if (!contentEl) return;
    closeModal();
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

    // --- FEATURE: the book — free PDF (primary) + optional printed copy ---
    const az = PAYMENTS.amazon[currentLang] || PAYMENTS.amazon.en;
    const pdfHref = PAYMENTS.pdf[currentLang] || PAYMENTS.pdf.en;
    const feat = methodCard("★", "book", tr.buyHeading, tr.buyNote);
    feat.classList.add("support-card--feature");
    const buyRow = el("div", { class: "support-btn-row" });
    if (pdfHref) {
      // Same-origin file, so the `download` attribute is honoured and the PDF
      // saves under its localized name instead of opening inline.
      buyRow.appendChild(
        el("a", { class: "support-btn primary", href: pdfHref, download: "" }, tr.buyPdf)
      );
    }
    if (az && az.print) {
      if (az.print.indexOf("REPLACE_ME") !== -1) {
        // Print edition not live yet — open a "coming soon" modal instead of
        // linking to a dead Amazon URL. Becomes a real link once az.print is set.
        const soon = el("button", { class: "support-btn", type: "button" }, tr.buyPrint);
        soon.addEventListener("click", () =>
          openModal("\u2605", "book", tr.buyPrint, (body) => {
            body.appendChild(el("p", { class: "support-modal-note" }, tr.printSoon));
          })
        );
        buyRow.appendChild(soon);
      } else {
        buyRow.appendChild(linkButton(az.print, tr.buyPrint));
      }
    }
    feat._body.appendChild(buyRow);
    root.appendChild(feat);

    // --- DIRECT SUPPORT: Revolut + PayPal as trigger cards -> detail modal ---
    const direct = group(tr.directHeading);

    // IBAN: the SEPA details for the (Revolut) account, shown first. No QR — the
    // only QR we generate encodes the Revolut-pay link, not a SEPA giro code.
    direct._grid.appendChild(triggerCard(LOGOS.bank, "bank", "SEPA/IBAN", (body) => {
      body.appendChild(copyRow(tr.holderLabel, PAYMENTS.revolut.holder));
      body.appendChild(copyRow(tr.ibanLabel, PAYMENTS.revolut.iban, PAYMENTS.revolut.iban.replace(/\s+/g, "")));
      if (PAYMENTS.revolut.bic) body.appendChild(copyRow(tr.bicLabel, PAYMENTS.revolut.bic));
    }));

    // Revolut: pay straight from the app via the revolut.me link + its QR. The
    // hosted checkout also takes card + Apple Pay (no account), shown as marks.
    direct._grid.appendChild(triggerCard(LOGOS.revolut, "revolut", "Revolut", (body) => {
      body.appendChild(linkButton(PAYMENTS.revolut.url, tr.payWith("Revolut"), "primary full"));
      body.appendChild(modalQr(PAYMENTS.revolut.qr, "Revolut QR"));
    }, { glyphs: [MARKS.card, MARKS.applepay], label: tr.acceptsCard }));

    direct._grid.appendChild(triggerCard(LOGOS.paypal, "paypal", "PayPal", (body) => {
      if (Array.isArray(PAYMENTS.paypal.presets) && PAYMENTS.paypal.presets.length) {
        const presets = el("div", { class: "support-presets" });
        PAYMENTS.paypal.presets.forEach((amt) => {
          presets.appendChild(linkButton(`${PAYMENTS.paypal.url}/${amt}`, money(amt), "preset"));
        });
        body.appendChild(presets);
      }
      // Any-amount entry; the presets above are just shortcuts into the same link.
      body.appendChild(amountField(PAYMENTS.paypal.url));
      body.appendChild(modalQr(PAYMENTS.paypal.qr, "PayPal QR"));
    }));
    root.appendChild(direct);

    // --- CRYPTO: one trigger card per coin -> detail modal ---
    const crypto = group(tr.cryptoHeading);
    PAYMENTS.crypto.forEach((c) => {
      crypto._grid.appendChild(triggerCard(LOGOS[c.key] || c.symbol, c.key, c.label, (body) => {
        if (Array.isArray(c.addresses)) {
          // Multiple receive formats (e.g. BTC Taproot + Native SegWit), each labelled.
          c.addresses.forEach((a) => body.appendChild(copyRow(a.label, a.address, a.address)));
        } else {
          body.appendChild(copyRow(null, c.address, c.address));
        }
        body.appendChild(modalQr(c.qr, `${c.label} QR`));
      }));
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
