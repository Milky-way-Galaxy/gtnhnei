/* === GTNH Workbench Feedback / Reports / Status === */
(() => {
  "use strict";

  if (window.__GTNH_FEEDBACK_V1__) return;
  window.__GTNH_FEEDBACK_V1__ = true;

  const REPO = "milky-way-galaxy/gtnhnei";
  const STATUS_URL = "feedback-status.json";
  const SEEN_KEY = "gtnh_feedback_seen_status_version_v1";
  const DRAFT_KEY = "gtnh_feedback_draft_v1";

  let statusData = null;
  let activeTab = "bug";

  const areaOptions = [
    "NEI",
    "Planner",
    "Calculator",
    "Favorites",
    "gtnh-flow",
    "Mobile UI",
    "Data / recipe",
    "Other"
  ];

  const severityOptions = [
    "Low",
    "Medium",
    "High",
    "Critical"
  ];

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function textOf(el) {
    return String(el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  }

  function nowIsoLocal() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");

    return (
      d.getFullYear() + "-" +
      pad(d.getMonth() + 1) + "-" +
      pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" +
      pad(d.getMinutes())
    );
  }

  function currentPageState() {
    const url = location.href;
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    const dpr = String(window.devicePixelRatio || 1);
    const ua = navigator.userAgent || "unknown";
    const platform = navigator.platform || "unknown";
    const language = navigator.language || "unknown";

    let currentSearch = "";
    try {
      const input =
        qs("input[type='search']") ||
        qs("input[placeholder*='Search' i]") ||
        qs("#search") ||
        qs(".search input");

      currentSearch = input?.value || "";
    } catch {}

    return {
      url,
      viewport,
      dpr,
      platform,
      language,
      userAgent: ua,
      searchText: currentSearch
    };
  }

  function fieldValue(id) {
    return qs(`#${id}`)?.value?.trim?.() || "";
  }

  function setField(id, value) {
    const el = qs(`#${id}`);
    if (el) el.value = value ?? "";
  }

  function toast(text) {
    let el = qs("#gtnhFeedbackToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "gtnhFeedbackToast";
      el.className = "gtnhFeedbackToast";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.classList.add("show");

    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function buildSelect(id, options, selected = "") {
    return `
      <select id="${esc(id)}">
        ${options.map(opt => `
          <option value="${esc(opt)}" ${opt === selected ? "selected" : ""}>${esc(opt)}</option>
        `).join("")}
      </select>
    `;
  }

  function findTopBar() {
    const direct =
      qs("#gtnhTopStrip") ||
      qs(".gtnhTopStrip") ||
      qs("#topTools") ||
      qs(".topTools") ||
      qs(".toolStrip") ||
      qs(".toolbar") ||
      qs(".mainNav");

    if (direct) return direct;

    const candidates = qsa("div, nav, header, section")
      .filter(el => {
        const buttons = qsa("button", el);
        if (buttons.length < 3 || buttons.length > 12) return false;

        const txt = buttons.map(textOf).join(" | ").toLowerCase();
        return (
          txt.includes("nei") &&
          (txt.includes("planner") || txt.includes("calc") || txt.includes("favorites") || txt.includes("help"))
        );
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return candidates[0] || null;
  }

  function ensureNavButton() {
    if (qs("#gtnhFeedbackOpen")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "gtnhFeedbackOpen";
    btn.className = "gtnhFeedbackButton";
    btn.textContent = "Feedback";
    btn.title = "Report bugs, send suggestions, and view official update status.";

    btn.addEventListener("click", () => open("bug"));

    const topBar = findTopBar();

    if (topBar) {
      const help = qsa("button", topBar).find(b => textOf(b).toLowerCase() === "help");
      if (help?.parentNode === topBar) {
        help.insertAdjacentElement("afterend", btn);
      } else {
        topBar.appendChild(btn);
      }
    } else {
      const fab = document.createElement("button");
      fab.type = "button";
      fab.id = "gtnhFeedbackFab";
      fab.className = "gtnhFeedbackFab";
      fab.textContent = "Feedback";
      fab.addEventListener("click", () => open("bug"));
      document.body.appendChild(fab);
    }
  }

  function buildReportBody(kind) {
    const page = currentPageState();

    if (kind === "bug") {
      return [
        "## Bug report",
        "",
        `**Title:** ${fieldValue("fbBugTitle") || "(write title)"}`,
        `**Area:** ${fieldValue("fbBugArea") || "Other"}`,
        `**Severity:** ${fieldValue("fbBugSeverity") || "Medium"}`,
        `**Time:** ${nowIsoLocal()}`,
        "",
        "## Description",
        fieldValue("fbBugDescription") || "(describe the bug)",
        "",
        "## Steps to reproduce",
        fieldValue("fbBugSteps") || "1. \n2. \n3. ",
        "",
        "## Expected behavior",
        fieldValue("fbBugExpected") || "(what should happen)",
        "",
        "## Actual behavior",
        fieldValue("fbBugActual") || "(what happened instead)",
        "",
        "## Page/device info",
        `- URL: ${page.url}`,
        `- Viewport: ${page.viewport}`,
        `- DPR: ${page.dpr}`,
        `- Platform: ${page.platform}`,
        `- Language: ${page.language}`,
        `- Current search text: ${page.searchText || "(none)"}`,
        `- User agent: ${page.userAgent}`,
        "",
        "## Extra notes / screenshots",
        fieldValue("fbBugExtra") || "(optional)"
      ].join("\n");
    }

    return [
      "## Suggestion",
      "",
      `**Title:** ${fieldValue("fbSugTitle") || "(write title)"}`,
      `**Area:** ${fieldValue("fbSugArea") || "Other"}`,
      `**Time:** ${nowIsoLocal()}`,
      "",
      "## What should change?",
      fieldValue("fbSugChange") || "(describe the idea)",
      "",
      "## Why is this useful?",
      fieldValue("fbSugWhy") || "(why this helps)",
      "",
      "## Possible implementation idea",
      fieldValue("fbSugImplementation") || "(optional)",
      "",
      "## Page/device info",
      `- URL: ${page.url}`,
      `- Viewport: ${page.viewport}`,
      `- DPR: ${page.dpr}`,
      `- Platform: ${page.platform}`,
      `- Language: ${page.language}`,
      `- Current search text: ${page.searchText || "(none)"}`,
      `- User agent: ${page.userAgent}`,
      "",
      "## Extra notes / screenshots",
      fieldValue("fbSugExtra") || "(optional)"
    ].join("\n");
  }

  function issueUrl(kind) {
    const isBug = kind === "bug";
    const titleRaw = isBug ? fieldValue("fbBugTitle") : fieldValue("fbSugTitle");
    const area = isBug ? fieldValue("fbBugArea") : fieldValue("fbSugArea");

    const titlePrefix = isBug ? "[Bug]" : "[Suggestion]";
    const title = `${titlePrefix} ${titleRaw || area || "GTNH Workbench report"}`;
    const body = buildReportBody(kind);

    const labels = isBug
      ? `bug,area:${area || "unknown"}`
      : `enhancement,area:${area || "unknown"}`;

    const params = new URLSearchParams({
      title,
      body,
      labels
    });

    return `https://github.com/${REPO}/issues/new?${params.toString()}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied.");
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();

      try {
        document.execCommand("copy");
        toast("Copied.");
        return true;
      } catch {
        toast("Copy failed.");
        return false;
      } finally {
        ta.remove();
      }
    }
  }

  function openIssue(kind) {
    const url = issueUrl(kind);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveDraft() {
    const draft = {
      fbBugTitle: fieldValue("fbBugTitle"),
      fbBugArea: fieldValue("fbBugArea"),
      fbBugSeverity: fieldValue("fbBugSeverity"),
      fbBugDescription: fieldValue("fbBugDescription"),
      fbBugSteps: fieldValue("fbBugSteps"),
      fbBugExpected: fieldValue("fbBugExpected"),
      fbBugActual: fieldValue("fbBugActual"),
      fbBugExtra: fieldValue("fbBugExtra"),
      fbSugTitle: fieldValue("fbSugTitle"),
      fbSugArea: fieldValue("fbSugArea"),
      fbSugChange: fieldValue("fbSugChange"),
      fbSugWhy: fieldValue("fbSugWhy"),
      fbSugImplementation: fieldValue("fbSugImplementation"),
      fbSugExtra: fieldValue("fbSugExtra")
    };

    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function loadDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
      for (const [k, v] of Object.entries(draft)) setField(k, v);
    } catch {}
  }

  function clearDraft(kind) {
    if (kind === "bug") {
      for (const id of [
        "fbBugTitle",
        "fbBugDescription",
        "fbBugSteps",
        "fbBugExpected",
        "fbBugActual",
        "fbBugExtra"
      ]) setField(id, "");
    } else {
      for (const id of [
        "fbSugTitle",
        "fbSugChange",
        "fbSugWhy",
        "fbSugImplementation",
        "fbSugExtra"
      ]) setField(id, "");
    }

    saveDraft();
    updatePreview();
  }

  function updatePreview() {
    const bugPrev = qs("#fbBugPreview");
    const sugPrev = qs("#fbSugPreview");

    if (bugPrev) bugPrev.textContent = buildReportBody("bug");
    if (sugPrev) sugPrev.textContent = buildReportBody("suggestion");
  }

  function renderBugForm() {
    return `
      <section class="gtnhFeedbackCard">
        <h3>Report a bug</h3>

        <div class="gtnhFeedbackGrid">
          <div class="gtnhFeedbackField full">
            <label for="fbBugTitle">Title</label>
            <input id="fbBugTitle" placeholder="Short bug title">
          </div>

          <div class="gtnhFeedbackField">
            <label for="fbBugArea">Area</label>
            ${buildSelect("fbBugArea", areaOptions, "Mobile UI")}
          </div>

          <div class="gtnhFeedbackField">
            <label for="fbBugSeverity">Severity</label>
            ${buildSelect("fbBugSeverity", severityOptions, "Medium")}
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbBugDescription">Description</label>
            <textarea id="fbBugDescription" placeholder="What is broken?"></textarea>
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbBugSteps">Steps to reproduce</label>
            <textarea id="fbBugSteps" placeholder="1. Open...\n2. Tap...\n3. It breaks..."></textarea>
          </div>

          <div class="gtnhFeedbackField">
            <label for="fbBugExpected">Expected</label>
            <textarea id="fbBugExpected" placeholder="What should happen?"></textarea>
          </div>

          <div class="gtnhFeedbackField">
            <label for="fbBugActual">Actual</label>
            <textarea id="fbBugActual" placeholder="What happened instead?"></textarea>
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbBugExtra">Extra notes / screenshots</label>
            <textarea id="fbBugExtra" placeholder="Paste extra notes, screenshots links, or Discord context."></textarea>
          </div>
        </div>

        <div class="gtnhFeedbackActions">
          <button type="button" class="primary" data-feedback-action="copy-bug">Copy bug report</button>
          <button type="button" data-feedback-action="open-bug">Open GitHub issue</button>
          <button type="button" data-feedback-action="clear-bug">Clear</button>
        </div>

        <pre id="fbBugPreview" class="gtnhFeedbackPreview"></pre>
      </section>
    `;
  }

  function renderSuggestionForm() {
    return `
      <section class="gtnhFeedbackCard">
        <h3>Send a suggestion</h3>

        <div class="gtnhFeedbackGrid">
          <div class="gtnhFeedbackField full">
            <label for="fbSugTitle">Title</label>
            <input id="fbSugTitle" placeholder="Short suggestion title">
          </div>

          <div class="gtnhFeedbackField">
            <label for="fbSugArea">Area</label>
            ${buildSelect("fbSugArea", areaOptions, "Planner")}
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbSugChange">What should change?</label>
            <textarea id="fbSugChange" placeholder="Describe what you want added/changed."></textarea>
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbSugWhy">Why is this useful?</label>
            <textarea id="fbSugWhy" placeholder="Why does this help GTNH players?"></textarea>
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbSugImplementation">Possible implementation</label>
            <textarea id="fbSugImplementation" placeholder="Optional. Any idea how it could work?"></textarea>
          </div>

          <div class="gtnhFeedbackField full">
            <label for="fbSugExtra">Extra notes / screenshots</label>
            <textarea id="fbSugExtra" placeholder="Optional."></textarea>
          </div>
        </div>

        <div class="gtnhFeedbackActions">
          <button type="button" class="primary" data-feedback-action="copy-suggestion">Copy suggestion</button>
          <button type="button" data-feedback-action="open-suggestion">Open GitHub issue</button>
          <button type="button" data-feedback-action="clear-suggestion">Clear</button>
        </div>

        <pre id="fbSugPreview" class="gtnhFeedbackPreview"></pre>
      </section>
    `;
  }

  function normStatusClass(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function statusIcon(status) {
    const s = normStatusClass(status);

    if (s === "fixed") return "✓";
    if (s === "done") return "✓";
    if (s === "changed") return "↻";
    if (s === "planned") return "＋";
    if (s === "investigating") return "…";
    if (s === "notdoing" || s === "rejected") return "×";

    return "•";
  }

  function renderStatusView() {
    const data = statusData || {
      version: "unknown",
      updated: "unknown",
      headline: "No status loaded",
      message: "feedback-status.json could not be loaded.",
      items: []
    };

    const publicItems = (data.items || []).filter(x => x.public !== false);

    return `
      <section class="gtnhFeedbackStatusTop">
        <div>
          <h3>${esc(data.headline || "Project status")}</h3>
          <p>${esc(data.message || "")}</p><p><b>Official rule:</b> only status updates published by the maintainer are final. GitHub issue comments are discussion.</p>
        </div>
        <div>
          <span class="gtnhFeedbackStatusBadge changed">Updated ${esc(data.updated || "unknown")}</span>
        </div>
      </section>

      <section class="gtnhFeedbackStatusList">
        ${
          publicItems.length
            ? publicItems.map(item => `
                <article class="gtnhFeedbackStatusItem">
                  <div class="gtnhFeedbackStatusItemHead">
                    <h4>${esc(item.title || item.id || "Untitled update")}</h4>
                    <span class="gtnhFeedbackStatusBadge ${esc(normStatusClass(item.status))}">
                      ${statusIcon(item.status)} ${esc(item.status || "status")}
                    </span>
                  </div>
                  <p>${esc(item.summary || "")}</p>
                  ${item.resolution ? `<p class="resolution"><b>Result:</b> ${esc(item.resolution)}</p>` : ""}
                  <p class="resolution">
                    <b>Area:</b> ${esc(item.area || "Unknown")}
                    ${item.type ? ` · <b>Type:</b> ${esc(item.type)}` : ""}
                    ${item.id ? ` · <b>ID:</b> ${esc(item.id)}` : ""}
                  </p>
                </article>
              `).join("")
            : `<article class="gtnhFeedbackStatusItem"><p>No public updates yet.</p></article>`
        }
      </section>
    `;
  }

  function ensureOverlay() {
    let ov = qs("#gtnhFeedbackOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtnhFeedbackOverlay";
    ov.className = "gtnhFeedbackOverlay";

    ov.innerHTML = `
      <div class="gtnhFeedbackPanel">
        <header class="gtnhFeedbackHeader">
          <div>
            <h2>Feedback</h2>
            <p>Report bugs, send suggestions, and check official maintainer status updates. Only maintainer-published status updates are official.</p>
          </div>
          <button type="button" class="gtnhFeedbackClose" aria-label="Close feedback">×</button>
        </header>

        <nav class="gtnhFeedbackTabs">
          <button type="button" data-feedback-tab="bug">Bug report</button>
          <button type="button" data-feedback-tab="suggestion">Suggestion</button>
          <button type="button" data-feedback-tab="status">Status / updates</button>
        </nav>

        <main class="gtnhFeedbackBody">
          <div class="gtnhFeedbackView" data-feedback-view="bug">${renderBugForm()}</div>
          <div class="gtnhFeedbackView" data-feedback-view="suggestion">${renderSuggestionForm()}</div>
          <div class="gtnhFeedbackView" data-feedback-view="status">${renderStatusView()}</div>
        </main>
      </div>
    `;

    document.body.appendChild(ov);

    ov.addEventListener("click", event => {
      if (event.target === ov) close();
    });

    qs(".gtnhFeedbackClose", ov)?.addEventListener("click", close);

    qsa("[data-feedback-tab]", ov).forEach(btn => {
      btn.addEventListener("click", () => {
        setTab(btn.dataset.feedbackTab || "bug");
      });
    });

    ov.addEventListener("input", event => {
      if (event.target.matches("input, textarea, select")) {
        saveDraft();
        updatePreview();
      }
    });

    ov.addEventListener("change", event => {
      if (event.target.matches("input, textarea, select")) {
        saveDraft();
        updatePreview();
      }
    });

    ov.addEventListener("click", event => {
      const btn = event.target.closest("[data-feedback-action]");
      if (!btn) return;

      const action = btn.dataset.feedbackAction;

      if (action === "copy-bug") copyText(buildReportBody("bug"));
      if (action === "open-bug") openIssue("bug");
      if (action === "clear-bug") clearDraft("bug");

      if (action === "copy-suggestion") copyText(buildReportBody("suggestion"));
      if (action === "open-suggestion") openIssue("suggestion");
      if (action === "clear-suggestion") clearDraft("suggestion");
    });

    loadDraft();
    updatePreview();

    return ov;
  }

  function refreshStatusView() {
    const ov = qs("#gtnhFeedbackOverlay");
    const view = ov?.querySelector('[data-feedback-view="status"]');
    if (view) view.innerHTML = renderStatusView();
  }

  function setTab(tab) {
    activeTab = tab;

    const ov = ensureOverlay();

    qsa("[data-feedback-tab]", ov).forEach(btn => {
      btn.classList.toggle("active", btn.dataset.feedbackTab === tab);
    });

    qsa("[data-feedback-view]", ov).forEach(view => {
      view.classList.toggle("active", view.dataset.feedbackView === tab);
    });

    if (tab === "status") {
      markStatusSeen();
    }
  }

  function open(tab = "bug") {
    ensureOverlay().classList.add("show");
    setTab(tab);
    updatePreview();
  }

  function close() {
    qs("#gtnhFeedbackOverlay")?.classList.remove("show");
  }

  async function loadStatus() {
    try {
      const res = await fetch(`${STATUS_URL}?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      statusData = await res.json();
      refreshStatusView();
      maybeShowStatusNotice();
    } catch {
      statusData = {
        version: "missing",
        updated: "unknown",
        headline: "Status file unavailable",
        message: "feedback-status.json could not be loaded.",
        items: []
      };
      refreshStatusView();
    }
  }

  function markStatusSeen() {
    if (!statusData?.version) return;
    localStorage.setItem(SEEN_KEY, statusData.version);
    qs("#gtnhFeedbackNotice")?.classList.remove("show");
  }

  function maybeShowStatusNotice() {
    if (!statusData?.version) return;

    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === statusData.version) return;

    const publicItems = (statusData.items || []).filter(x => x.public !== false);
    if (!publicItems.length) return;

    let notice = qs("#gtnhFeedbackNotice");

    if (!notice) {
      notice = document.createElement("div");
      notice.id = "gtnhFeedbackNotice";
      notice.className = "gtnhFeedbackNotice";
      document.body.appendChild(notice);
    }

    notice.innerHTML = `
      <div>
        <b>${esc(statusData.headline || "Workbench updated")}</b><br>
        <span>${esc(statusData.message || `${publicItems.length} update(s) available.`)}</span>
      </div>
      <button type="button" data-feedback-open-status>View</button>
      <button type="button" data-feedback-dismiss-status>OK</button>
    `;

    notice.classList.add("show");

    qs("[data-feedback-open-status]", notice)?.addEventListener("click", () => open("status"));
    qs("[data-feedback-dismiss-status]", notice)?.addEventListener("click", markStatusSeen);
  }

  function hookEscape() {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        close();
      }
    });
  }

  function start() {
    ensureNavButton();
    ensureOverlay();
    setTab(activeTab);
    hookEscape();
    loadStatus();

    const mo = new MutationObserver(() => {
      clearTimeout(window.__gtnhFeedbackNavTimer);
      window.__gtnhFeedbackNavTimer = setTimeout(ensureNavButton, 200);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.GTNH_FEEDBACK = {
      open,
      close,
      loadStatus,
      getStatus: () => statusData,
      copyBug: () => copyText(buildReportBody("bug")),
      copySuggestion: () => copyText(buildReportBody("suggestion"))
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
