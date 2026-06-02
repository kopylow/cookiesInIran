const $ = (s) => document.querySelector(s);
const $err = $("#error");

// ── Utilities ──────────────────────────────────────────────────────────────
function showError(msg) { $err.textContent = msg; $err.style.display = "block"; }
function clearError() { $err.style.display = "none"; }

function confirmAction(msg) {
  const skip = $("#skip-confirm");
  if (skip && skip.checked) return true;
  return confirm(msg);
}

function promptAction(msg, def = "") {
  const skip = $("#skip-confirm");
  if (skip && skip.checked) return def;
  return prompt(msg, def);
}

// ── Auth state ───────────────────────────────────────────────────────────────
// The password lives in one in-memory variable, hydrated from sessionStorage so a
// page reload in the same tab stays logged in. The login overlay is the only place
// it is set; api() reads it and, on a 401, clears it and re-shows the overlay.
let adminPw = sessionStorage.getItem("admin_pw") || "";

function showLogin(msg) {
  $("#login-error").textContent = msg || "";
  $("#login-overlay").classList.remove("hidden");
  const input = $("#login-pw");
  input.value = "";
  input.focus();
}

function hideLogin() {
  $("#login-overlay").classList.add("hidden");
}

function logout() {
  adminPw = "";
  sessionStorage.removeItem("admin_pw");
  showLogin();
}

function fmtTime(unix) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("de-DE");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

async function api(method, url, body) {
  const headers = body ? { "content-type": "application/json" } : {};
  if (adminPw) headers["authorization"] = "Bearer " + adminPw;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    adminPw = "";
    sessionStorage.removeItem("admin_pw");
    showLogin("Falsches Passwort.");
    throw new Error("401 Falsches Passwort");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error || ""; } catch {}
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $(`#panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Comments tab ───────────────────────────────────────────────────────────
const $cList = $("#comments-list");
const $cEmpty = $("#empty-comments");
const $cPrev = $("#c-prev");
const $cNext = $("#c-next");

let beforeStack = []; // cursor stack for back-navigation
let currentBefore = null;
let currentNextBefore = null;

async function loadComments(before) {
  clearError();
  $cList.innerHTML = "Lade…";
  $cEmpty.style.display = "none";
  const lang = $("#c-lang").value;
  const status = $("#c-status").value;
  const thread = $("#c-thread").value.trim();
  const params = new URLSearchParams({ limit: "50" });
  if (lang) params.set("lang", lang);
  if (status) params.set("status", status);
  if (thread) params.set("thread", thread);
  if (before) params.set("before", before);
  try {
    const data = await api("GET", "/api/admin/comments?" + params);
    renderComments(data.comments || []);
    currentNextBefore = data.next_before || null;
    $cNext.disabled = !currentNextBefore;
  } catch (e) {
    $cList.innerHTML = "";
    showError("Laden fehlgeschlagen: " + e.message);
  }
}

function renderComments(comments) {
  $cList.innerHTML = "";
  if (!comments.length) { $cEmpty.style.display = "block"; return; }
  for (const c of comments) {
    const card = document.createElement("div");
    card.className = "card" + (c.status !== "visible" ? " status-" + c.status : "");
    const verifiedBadge = c.identity_id ? `<span class="badge verified">✓</span>` : "";
    const statusBadge = c.status !== "visible" ? `<span class="badge ${esc(c.status)}">${esc(c.status)}</span>` : "";
    card.innerHTML = `
      <div class="meta">
        Thread: <strong>${esc(c.thread_id)}</strong> · ${fmtTime(c.created_at)}
        ${c.parent_id ? `· Antwort auf <code>${esc(c.parent_id.slice(0,8))}…</code>` : ""}
      </div>
      <div class="meta">
        <strong>${esc(c.display_name)}</strong>${verifiedBadge}${statusBadge}
        · ID: <code>${esc(c.id.slice(0,8))}…</code>
      </div>
      <div class="body">${esc(c.body)}</div>
      <div class="actions">
        <button data-act="visible" data-id="${esc(c.id)}">Sichtbar</button>
        <button data-act="hidden" data-id="${esc(c.id)}">Verstecken</button>
        <button data-act="deleted" data-id="${esc(c.id)}" class="danger">Löschen</button>
        <button data-act="anonymize" data-id="${esc(c.id)}" class="danger">DSGVO</button>
        ${c.identity_id ? `<button data-act="ban" data-iid="${esc(c.identity_id)}" class="danger">Sperren</button>` : ""}
      </div>
    `;
    $cList.appendChild(card);
  }
}

$cList.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    if (act === "visible" || act === "hidden" || act === "deleted") {
      if (act === "deleted" && !confirmAction("Kommentar löschen?")) { btn.disabled = false; return; }
      await api("POST", `/api/admin/comments/${id}/status`, { status: act });
    } else if (act === "anonymize") {
      if (!confirmAction("DSGVO-anonymisieren? Inhalt geht verloren, Threading bleibt.")) { btn.disabled = false; return; }
      await api("POST", `/api/admin/comments/${id}/anonymize`);
    } else if (act === "ban") {
      const reason = promptAction("Grund für die Sperre (optional):", "") || null;
      const days = promptAction("Sperrdauer in Tagen (leer = unbefristet):", "");
      if (reason === null && days === null) { btn.disabled = false; return; } // canceled prompt returns null
      const untilSec = days && Number(days) > 0
        ? Math.floor(Date.now() / 1000) + Math.floor(Number(days) * 86400)
        : null;
      await api("POST", `/api/admin/identities/${btn.dataset.iid}/ban`, { reason, untilSec });
    }
    await loadComments(currentBefore);
  } catch (e) {
    showError("Aktion fehlgeschlagen: " + e.message);
    btn.disabled = false;
  }
});

$("#c-load").addEventListener("click", () => {
  beforeStack = [];
  currentBefore = null;
  $cPrev.disabled = true;
  loadComments(null);
});

$("#c-refresh").addEventListener("click", () => loadComments(currentBefore));

$cNext.addEventListener("click", () => {
  beforeStack.push(currentBefore);
  currentBefore = currentNextBefore;
  $cPrev.disabled = false;
  loadComments(currentBefore);
});

$cPrev.addEventListener("click", () => {
  currentBefore = beforeStack.pop() || null;
  $cPrev.disabled = beforeStack.length === 0;
  loadComments(currentBefore);
});

// ── Reports tab ────────────────────────────────────────────────────────────
const $rList = $("#reports-list");
const $rEmpty = $("#empty-reports");

async function loadReports() {
  clearError();
  $rList.innerHTML = "Lade…";
  $rEmpty.style.display = "none";
  const includeResolved = $("#show-resolved").checked ? "?resolved=1" : "";
  try {
    const data = await api("GET", "/api/admin/reports" + includeResolved);
    renderReports(data.reports || []);
  } catch (e) {
    $rList.innerHTML = "";
    showError("Laden fehlgeschlagen: " + e.message);
  }
}

function renderReports(reports) {
  $rList.innerHTML = "";
  if (!reports.length) { $rEmpty.style.display = "block"; return; }
  for (const r of reports) {
    const card = document.createElement("div");
    card.className = "card" + (r.status ? " status-" + r.status : "");
    card.innerHTML = `
      <div class="meta">
        Thread: <strong>${esc(r.thread_id)}</strong> · Gemeldet ${fmtTime(r.reported_at)}${r.resolved_at ? " · erledigt " + fmtTime(r.resolved_at) : ""}
      </div>
      <div class="meta">
        Von <strong>${esc(r.display_name)}</strong>${r.identity_id ? " <span class='badge verified'>✓</span>" : ""} · Status: <strong>${esc(r.status || "n/a")}</strong>
      </div>
      ${r.reason ? `<div class="meta">Grund: ${esc(r.reason)}</div>` : ""}
      <div class="body">${esc(r.body) || "<em>(Kommentar nicht gefunden)</em>"}</div>
      <div class="actions">
        ${r.comment_id ? `
          <button data-act="r-visible" data-id="${esc(r.comment_id)}">Sichtbar</button>
          <button data-act="r-hidden" data-id="${esc(r.comment_id)}">Verstecken</button>
          <button data-act="r-deleted" data-id="${esc(r.comment_id)}" class="danger">Löschen</button>
          <button data-act="r-anonymize" data-id="${esc(r.comment_id)}" class="danger">DSGVO</button>
          ${r.identity_id ? `<button data-act="r-ban" data-iid="${esc(r.identity_id)}" class="danger">Sperren</button>` : ""}
        ` : ""}
        <button data-act="r-resolve" data-rid="${esc(r.report_id)}">Erledigt</button>
      </div>
    `;
    $rList.appendChild(card);
  }
}

$rList.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  btn.disabled = true;
  try {
    if (act === "r-visible" || act === "r-hidden" || act === "r-deleted") {
      if (act === "r-deleted" && !confirmAction("Kommentar löschen?")) { btn.disabled = false; return; }
      await api("POST", `/api/admin/comments/${btn.dataset.id}/status`, { status: act.slice(2) });
    } else if (act === "r-anonymize") {
      if (!confirmAction("DSGVO-anonymisieren? Inhalt geht verloren, Threading bleibt.")) { btn.disabled = false; return; }
      await api("POST", `/api/admin/comments/${btn.dataset.id}/anonymize`);
    } else if (act === "r-ban") {
      const reason = promptAction("Grund für die Sperre (optional):", "") || null;
      const days = promptAction("Sperrdauer in Tagen (leer = unbefristet):", "");
      if (reason === null && days === null) { btn.disabled = false; return; }
      const untilSec = days && Number(days) > 0
        ? Math.floor(Date.now() / 1000) + Math.floor(Number(days) * 86400)
        : null;
      await api("POST", `/api/admin/identities/${btn.dataset.iid}/ban`, { reason, untilSec });
    } else if (act === "r-resolve") {
      await api("POST", `/api/admin/reports/${btn.dataset.rid}/resolve`);
    }
    await loadReports();
  } catch (e) {
    showError("Aktion fehlgeschlagen: " + e.message);
    btn.disabled = false;
  }
});

$("#r-refresh").addEventListener("click", loadReports);
$("#show-resolved").addEventListener("change", loadReports);

// ── Login / boot ─────────────────────────────────────────────────────────────
function bootLoad() {
  loadComments(null);
  loadReports();
}

$("#login-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const pw = $("#login-pw").value;
  if (!pw) { showLogin("Bitte Passwort eingeben."); return; }
  const btn = $("#login-btn");
  btn.disabled = true;
  adminPw = pw;
  try {
    // A cheap authenticated request validates the password before we commit it.
    await api("GET", "/api/admin/comments?limit=1");
    sessionStorage.setItem("admin_pw", pw);
    hideLogin();
    bootLoad();
  } catch (e) {
    // api() already re-shows the overlay with "Falsches Passwort" on a 401;
    // surface anything else (e.g. network/server errors) here.
    if (adminPw) showLogin("Login fehlgeschlagen: " + e.message);
  } finally {
    btn.disabled = false;
  }
});

$("#logout").addEventListener("click", logout);

// Hydrated from sessionStorage: try straight through, falling back to the gate
// if the cached password is stale (api() shows the overlay on 401). With no
// cached password, show the gate immediately instead of firing doomed requests.
if (adminPw) {
  bootLoad();
} else {
  showLogin();
}
