/* === GTNH Workbench Feedback Hub v1 === */
(() => {
  "use strict";

  if (window.__GTNH_FEEDBACK_HUB_V1__) return;
  window.__GTNH_FEEDBACK_HUB_V1__ = true;

  const REPO = "milky-way-galaxy/gtnhnei";
  const GH = `https://github.com/${REPO}`;
  const API = `https://api.github.com/repos/${REPO}`;
  const CACHE_KEY = "gtnh_feedback_hub_issues_cache_v1";
  const CACHE_MS = 2 * 60 * 1000;

  let issues = [];
  let loading = false;
  let loadError = "";
  let activeTab = "bug";

  const reportState = {
    q: "",
    type: "all",
    state: "all",
    sort: "priority"
  };

  const areas = [
    "NEI",
    "Planner",
    "Calculator",
    "Favorites",
    "gtnh-flow",
    "Mobile UI",
    "Data / recipe",
    "Other"
  ];

  const severities = ["Low", "Medium", "High", "Critical"];

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function text(s) {
    return String(s ?? "").replace(/\s+/g, " ").trim();
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return [...root.querySelectorAll(sel)];
  }

  function val(id) {
    return qs("#" + id)?.value?.trim?.() || "";
  }

  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function selectHtml(id, arr, selected) {
    return `<select id="${esc(id)}">${arr.map(x => `<option value="${esc(x)}" ${x === selected ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
  }

  function nowLocal() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pageInfo() {
    let search = "";
    try {
      const input =
        qs("input[type='search']") ||
        qs("input[placeholder*='Search' i]") ||
        qs("#search") ||
        qs(".search input");
      search = input?.value || "";
    } catch {}

    return {
      url: location.href,
      viewport: `${innerWidth}x${innerHeight}`,
      dpr: devicePixelRatio || 1,
      platform: navigator.platform || "unknown",
      language: navigator.language || "unknown",
      search,
      userAgent: navigator.userAgent || "unknown"
    };
  }

  function toast(msg) {
    let el = qs("#gtfbToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "gtfbToast";
      el.className = "gtfbToast";
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1600);
  }

  async function copyText(s) {
    try {
      await navigator.clipboard.writeText(s);
      toast("Copied.");
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = s;
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

  function reportBody(type) {
    const p = pageInfo();

    if (type === "bug") {
      return [
        "## Bug report",
        "",
        `**Title:** ${val("gtfbBugTitle") || "(write title)"}`,
        `**Area:** ${val("gtfbBugArea") || "Other"}`,
        `**Severity:** ${val("gtfbBugSeverity") || "Medium"}`,
        `**Time:** ${nowLocal()}`,
        "",
        "## Description",
        val("gtfbBugDesc") || "(describe the bug)",
        "",
        "## Steps to reproduce",
        val("gtfbBugSteps") || "1. \n2. \n3. ",
        "",
        "## Expected",
        val("gtfbBugExpected") || "(what should happen)",
        "",
        "## Actual",
        val("gtfbBugActual") || "(what happened instead)",
        "",
        "## Page / device",
        `- URL: ${p.url}`,
        `- Viewport: ${p.viewport}`,
        `- DPR: ${p.dpr}`,
        `- Platform: ${p.platform}`,
        `- Language: ${p.language}`,
        `- Current search: ${p.search || "(none)"}`,
        `- User agent: ${p.userAgent}`,
        "",
        "## Extra notes / screenshots",
        val("gtfbBugExtra") || "(optional)"
      ].join("\n");
    }

    return [
      "## Suggestion",
      "",
      `**Title:** ${val("gtfbSugTitle") || "(write title)"}`,
      `**Area:** ${val("gtfbSugArea") || "Other"}`,
      `**Time:** ${nowLocal()}`,
      "",
      "## What should change?",
      val("gtfbSugChange") || "(describe the change)",
      "",
      "## Why is this useful?",
      val("gtfbSugWhy") || "(why it helps)",
      "",
      "## Possible implementation",
      val("gtfbSugImpl") || "(optional)",
      "",
      "## Page / device",
      `- URL: ${p.url}`,
      `- Viewport: ${p.viewport}`,
      `- DPR: ${p.dpr}`,
      `- Platform: ${p.platform}`,
      `- Language: ${p.language}`,
      `- Current search: ${p.search || "(none)"}`,
      `- User agent: ${p.userAgent}`,
      "",
      "## Extra notes / screenshots",
      val("gtfbSugExtra") || "(optional)"
    ].join("\n");
  }

  function issueUrl(type) {
    const bug = type === "bug";

    const title = bug
      ? `[Bug] ${val("gtfbBugTitle") || val("gtfbBugArea") || "GTNH Workbench bug"}`
      : `[Suggestion] ${val("gtfbSugTitle") || val("gtfbSugArea") || "GTNH Workbench suggestion"}`;

    const labels = bug
      ? `bug,area:${val("gtfbBugArea") || "Other"}`
      : `enhancement,suggestion,area:${val("gtfbSugArea") || "Other"}`;

    const template = bug ? "bug_report.md" : "feature_request.md";

    // Keep the URL small. Mobile GitHub can choke on huge encoded bodies.
    // The body is copied to clipboard separately before opening GitHub.
    const params = new URLSearchParams({
      template,
      title,
      labels
    });

    return `${GH}/issues/new?${params.toString()}`;
  }

  async function openIssue(type) {
    const body = reportBody(type);
    await copyText(body);
    toast("Report copied. Paste it into GitHub if the body is empty.");
    window.open(issueUrl(type), "_blank", "noopener,noreferrer");
  }

  function findNav() {
    const direct =
      qs("#gtnhTopStrip") ||
      qs(".gtnhTopStrip") ||
      qs(".topStrip") ||
      qs(".mainNav") ||
      qs(".toolStrip") ||
      qs("nav");

    if (direct) return direct;

    const candidates = qsa("div, header, section")
      .filter(el => {
        const btns = qsa("button", el);
        if (btns.length < 3 || btns.length > 14) return false;
        const t = btns.map(b => text(b.textContent).toLowerCase()).join(" ");
        return t.includes("nei") && (t.includes("planner") || t.includes("calc") || t.includes("favorites"));
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return candidates[0] || null;
  }

  function ensureButton() {
    if (qs("#gtfbOpen")) return;

    const btn = document.createElement("button");
    btn.id = "gtfbOpen";
    btn.type = "button";
    btn.textContent = "Feedback";
    btn.title = "Report bugs, suggest features, and view public reports.";
    btn.addEventListener("click", () => open("bug"));

    const nav = findNav();

    if (nav) {
      const help = qsa("button", nav).find(b => text(b.textContent).toLowerCase() === "help");
      if (help && help.parentElement === nav) help.insertAdjacentElement("afterend", btn);
      else nav.appendChild(btn);
    } else {
      btn.className = "gtfbFab";
      document.body.appendChild(btn);
    }
  }

  function bugHtml() {
    return `
      <section class="gtfbCard">
        <h3>Report a bug</h3>
        <div class="gtfbGrid">
          <div class="gtfbField full">
            <label>Title</label>
            <input id="gtfbBugTitle" placeholder="Short bug title">
          </div>
          <div class="gtfbField">
            <label>Area</label>
            ${selectHtml("gtfbBugArea", areas, "Mobile UI")}
          </div>
          <div class="gtfbField">
            <label>Severity</label>
            ${selectHtml("gtfbBugSeverity", severities, "Medium")}
          </div>
          <div class="gtfbField full">
            <label>Description</label>
            <textarea id="gtfbBugDesc" placeholder="What is broken?"></textarea>
          </div>
          <div class="gtfbField full">
            <label>Steps</label>
            <textarea id="gtfbBugSteps" placeholder="1. Open...\n2. Tap...\n3. It breaks..."></textarea>
          </div>
          <div class="gtfbField">
            <label>Expected</label>
            <textarea id="gtfbBugExpected" placeholder="What should happen?"></textarea>
          </div>
          <div class="gtfbField">
            <label>Actual</label>
            <textarea id="gtfbBugActual" placeholder="What happened instead?"></textarea>
          </div>
          <div class="gtfbField full">
            <label>Extra / screenshots</label>
            <textarea id="gtfbBugExtra" placeholder="Paste screenshots links or notes."></textarea>
          </div>
        </div>
        <div class="gtfbActions">
          <button class="primary" type="button" data-act="copyBug">Copy bug report</button>
          <button type="button" data-act="openBug">Open GitHub issue</button>
          <a href="${GH}/issues/new/choose" target="_blank" rel="noopener noreferrer">Issue templates</a>
        </div>
        <pre id="gtfbBugPreview" class="gtfbPreview"></pre>
      </section>
    `;
  }

  function sugHtml() {
    return `
      <section class="gtfbCard">
        <h3>Suggest a feature</h3>
        <div class="gtfbGrid">
          <div class="gtfbField full">
            <label>Title</label>
            <input id="gtfbSugTitle" placeholder="Short suggestion title">
          </div>
          <div class="gtfbField">
            <label>Area</label>
            ${selectHtml("gtfbSugArea", areas, "Planner")}
          </div>
          <div class="gtfbField full">
            <label>What should change?</label>
            <textarea id="gtfbSugChange" placeholder="Describe the feature/change."></textarea>
          </div>
          <div class="gtfbField full">
            <label>Why useful?</label>
            <textarea id="gtfbSugWhy" placeholder="Why does this help GTNH players?"></textarea>
          </div>
          <div class="gtfbField full">
            <label>Implementation idea</label>
            <textarea id="gtfbSugImpl" placeholder="Optional."></textarea>
          </div>
          <div class="gtfbField full">
            <label>Extra / screenshots</label>
            <textarea id="gtfbSugExtra" placeholder="Optional."></textarea>
          </div>
        </div>
        <div class="gtfbActions">
          <button class="primary" type="button" data-act="copySug">Copy suggestion</button>
          <button type="button" data-act="openSug">Open GitHub issue</button>
          <a href="${GH}/issues/new/choose" target="_blank" rel="noopener noreferrer">Issue templates</a>
        </div>
        <pre id="gtfbSugPreview" class="gtfbPreview"></pre>
      </section>
    `;
  }

  function labels(issue) {
    return (issue.labels || []).map(x => typeof x === "string" ? x : x.name).filter(Boolean);
  }

  function typeOf(issue) {
    const l = labels(issue).map(x => x.toLowerCase());
    const t = issue.title || "";
    if (l.includes("bug") || /^\s*\[bug\]/i.test(t)) return "bug";
    if (l.includes("enhancement") || l.includes("suggestion") || /^\s*\[suggestion\]/i.test(t)) return "suggestion";
    return "report";
  }

  function areaOf(issue) {
    const a = labels(issue).find(x => x.toLowerCase().startsWith("area:"));
    return a ? a.replace(/^area:/i, "").trim() : "general";
  }

  function statusOf(issue) {
    const s = labels(issue).find(x => /^status:/i.test(x));
    if (s) return s.replace(/^status:/i, "").trim();
    const direct = labels(issue).find(x => /^(fixed|done|changed|planned|investigating|not doing)$/i.test(x));
    return direct || issue.state;
  }

  function votes(issue) {
    return Number(issue.reactions?.["+1"] || 0);
  }

  function stripMd(md) {
    return text(String(md || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]+`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/[>#*_|\-]+/g, " "));
  }

  function dateShort(raw) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "unknown";
    return d.toISOString().slice(0, 10);
  }

  function priority(issue) {
    return votes(issue) * 1000 + Number(issue.comments || 0) * 40 + (issue.state === "open" ? 25 : 0) + (typeOf(issue) === "bug" ? 10 : 0);
  }

  function readCache() {
    try {
      const x = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!x || !Array.isArray(x.data)) return null;
      if (Date.now() - x.t > CACHE_MS) return null;
      return x.data;
    } catch {
      return null;
    }
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
    } catch {}
  }

  async function loadIssues(force = false) {
    if (loading) return;

    if (!force) {
      const cached = readCache();
      if (cached) {
        issues = cached;
        renderReports();
      }
    }

    loading = true;
    loadError = "";
    renderReports();

    try {
      const res = await fetch(`${API}/issues?state=all&per_page=100&sort=updated&direction=desc`, {
        headers: { "Accept": "application/vnd.github+json" },
        cache: "no-store"
      });

      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);

      const data = await res.json();
      issues = data.filter(x => !x.pull_request);
      saveCache(issues);
    } catch (err) {
      loadError = String(err?.message || err || "unknown error");
    } finally {
      loading = false;
      renderReports();
    }
  }

  function filtered() {
    const q = reportState.q.trim().toLowerCase();
    let out = issues.slice();

    if (reportState.type !== "all") out = out.filter(x => typeOf(x) === reportState.type);
    if (reportState.state !== "all") out = out.filter(x => x.state === reportState.state);

    if (q) {
      out = out.filter(x => [
        x.number,
        x.title,
        x.user?.login,
        stripMd(x.body),
        labels(x).join(" "),
        areaOf(x),
        statusOf(x),
        typeOf(x)
      ].join(" ").toLowerCase().includes(q));
    }

    if (reportState.sort === "priority") out.sort((a,b) => priority(b) - priority(a));
    if (reportState.sort === "votes") out.sort((a,b) => votes(b) - votes(a));
    if (reportState.sort === "newest") out.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (reportState.sort === "updated") out.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    if (reportState.sort === "comments") out.sort((a,b) => Number(b.comments || 0) - Number(a.comments || 0));

    return out;
  }

  function reportCard(issue) {
    const type = typeOf(issue);
    const lab = [...new Set([type, issue.state, statusOf(issue), ...labels(issue)])].filter(Boolean).slice(0, 12);
    const body = stripMd(issue.body).slice(0, 260);

    return `
      <article class="gtfbReport ${esc(type)} ${issue.state === "closed" ? "closed" : ""}">
        <div class="gtfbReportTop">
          <div>
            <h4>
              <a href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">
                <span class="gtfbNum">#${esc(issue.number)}</span>
                ${esc(issue.title || "Untitled report")}
              </a>
            </h4>
            <div class="gtfbReportBody">${body ? esc(body) : "<i>No description.</i>"}</div>
          </div>
          <div class="gtfbVotes">
            <span class="gtfbVoteBadge">👍 ${votes(issue)}</span>
            <a class="gtfbVoteLink" href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">Vote on GitHub</a>
          </div>
        </div>

        <div class="gtfbLabels">
          ${lab.map(x => `<span class="gtfbLabel ${esc(slug(x))}">${esc(x)}</span>`).join("")}
        </div>

        <div class="gtfbFoot">
          <span>${esc(type)} · ${esc(areaOf(issue))} · ${esc(statusOf(issue))} · ${Number(issue.comments || 0)} comment(s) · updated ${esc(dateShort(issue.updated_at))}</span>
          <a href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">Open report</a>
        </div>
      </article>
    `;
  }

  function reportsHtml() {
    const shown = filtered();
    const open = issues.filter(x => x.state === "open").length;
    const closed = issues.filter(x => x.state === "closed").length;

    return `
      <section class="gtfbCard">
        <h3>Public reports / votes</h3>

        <div class="gtfbNotice">
          Reports are public GitHub Issues. To vote, open a report and press GitHub's 👍 reaction.
          Higher 👍 count = higher priority. Official answers still come from maintainer labels/status.
        </div>

        <div class="gtfbToolbar">
          <input id="gtfbReportSearch" type="search" placeholder="Search bugs, suggestions, labels..." value="${esc(reportState.q)}">

          <select id="gtfbReportType">
            <option value="all" ${reportState.type === "all" ? "selected" : ""}>All</option>
            <option value="bug" ${reportState.type === "bug" ? "selected" : ""}>Bugs</option>
            <option value="suggestion" ${reportState.type === "suggestion" ? "selected" : ""}>Suggestions</option>
            <option value="report" ${reportState.type === "report" ? "selected" : ""}>Other</option>
          </select>

          <select id="gtfbReportState">
            <option value="all" ${reportState.state === "all" ? "selected" : ""}>Open + closed</option>
            <option value="open" ${reportState.state === "open" ? "selected" : ""}>Open</option>
            <option value="closed" ${reportState.state === "closed" ? "selected" : ""}>Closed</option>
          </select>

          <select id="gtfbReportSort">
            <option value="priority" ${reportState.sort === "priority" ? "selected" : ""}>Priority</option>
            <option value="votes" ${reportState.sort === "votes" ? "selected" : ""}>Most liked</option>
            <option value="updated" ${reportState.sort === "updated" ? "selected" : ""}>Recently updated</option>
            <option value="newest" ${reportState.sort === "newest" ? "selected" : ""}>Newest</option>
            <option value="comments" ${reportState.sort === "comments" ? "selected" : ""}>Most discussed</option>
          </select>

          <button id="gtfbRefresh" type="button">Refresh</button>
        </div>

        <div class="gtfbMeta">
          <span><b>${shown.length}</b> shown</span>
          <span><b>${issues.length}</b> loaded</span>
          <span><b>${open}</b> open</span>
          <span><b>${closed}</b> closed</span>
        </div>

        <div id="gtfbReports" class="gtfbReports">
          ${
            loading && !issues.length
              ? `<div class="gtfbLoading">Loading GitHub reports...</div>`
              : loadError
                ? `<div class="gtfbError">Could not load public reports: ${esc(loadError)}<br><br><a href="${GH}/issues" target="_blank" rel="noopener noreferrer">Open GitHub Issues directly</a></div>`
                : shown.length
                  ? shown.map(reportCard).join("")
                  : `<div class="gtfbEmpty">No reports match this filter.</div>`
          }
        </div>
      </section>
    `;
  }

  async function statusHtml() {
    return `
      <section class="gtfbCard">
        <h3>Status / official updates</h3>
        <div class="gtfbNotice">
          This tab uses <code>feedback-status.json</code>. Public comments are discussion.
          Maintainer-published status is the official answer.
        </div>
        <div id="gtfbStatusBox" class="gtfbReports">
          <div class="gtfbLoading">Loading status...</div>
        </div>
      </section>
    `;
  }

  async function loadStatusBox() {
    const box = qs("#gtfbStatusBox");
    if (!box) return;

    try {
      const res = await fetch(`feedback-status.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = (data.items || []).filter(x => x.public !== false);

      box.innerHTML = `
        <div class="gtfbNotice">
          <b>${esc(data.headline || "Project status")}</b><br>
          ${esc(data.message || "")}<br>
          Updated: ${esc(data.updated || "unknown")}
        </div>
        ${
          items.length
            ? items.map(item => `
                <article class="gtfbReport ${esc(slug(item.type || ""))}">
                  <div class="gtfbReportTop">
                    <div>
                      <h4>${esc(item.title || item.id || "Untitled update")}</h4>
                      <div class="gtfbReportBody">${esc(item.summary || "")}</div>
                      ${item.resolution ? `<div class="gtfbReportBody"><b>Result:</b> ${esc(item.resolution)}</div>` : ""}
                    </div>
                    <div class="gtfbVotes"><span class="gtfbVoteBadge">${esc(item.status || "status")}</span></div>
                  </div>
                  <div class="gtfbLabels">
                    <span class="gtfbLabel ${esc(slug(item.status))}">${esc(item.status || "status")}</span>
                    <span class="gtfbLabel">${esc(item.area || "General")}</span>
                    <span class="gtfbLabel">${esc(item.type || "update")}</span>
                  </div>
                </article>
              `).join("")
            : `<div class="gtfbEmpty">No public status updates yet.</div>`
        }
      `;
    } catch (err) {
      box.innerHTML = `<div class="gtfbError">Could not load status: ${esc(err?.message || err)}</div>`;
    }
  }

  function ensureOverlay() {
    let ov = qs("#gtfbOverlay");
    if (ov) return ov;

    ov = document.createElement("div");
    ov.id = "gtfbOverlay";
    ov.className = "gtfbOverlay";

    ov.innerHTML = `
      <div class="gtfbPanel">
        <header class="gtfbHead">
          <div>
            <h2>Feedback</h2>
            <p>Report bugs, suggest features, search public reports, and vote with GitHub 👍 reactions.</p>
          </div>
          <button class="gtfbClose" type="button" aria-label="Close">×</button>
        </header>

        <nav class="gtfbTabs">
          <button type="button" data-tab="bug">Bug report</button>
          <button type="button" data-tab="suggestion">Suggestion</button>
          <button type="button" data-tab="reports">Reports / votes</button>
          <button type="button" data-tab="status">Status</button>
        </nav>

        <main class="gtfbBody">
          <div class="gtfbView" data-view="bug">${bugHtml()}</div>
          <div class="gtfbView" data-view="suggestion">${sugHtml()}</div>
          <div class="gtfbView" data-view="reports">${reportsHtml()}</div>
          <div class="gtfbView" data-view="status"></div>
        </main>
      </div>
    `;

    document.body.appendChild(ov);

    ov.addEventListener("click", e => {
      if (e.target === ov) close();
      const closeBtn = e.target.closest(".gtfbClose");
      if (closeBtn) close();

      const tab = e.target.closest("[data-tab]");
      if (tab) setTab(tab.dataset.tab);

      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "copyBug") copyText(reportBody("bug"));
      if (act === "openBug") openIssue("bug");
      if (act === "copySug") copyText(reportBody("suggestion"));
      if (act === "openSug") openIssue("suggestion");

      if (e.target.id === "gtfbRefresh") loadIssues(true);
    });

    ov.addEventListener("input", e => {
      if (e.target.id === "gtfbReportSearch") {
        reportState.q = e.target.value;
        renderReports();
      } else {
        updatePreviews();
      }
    });

    ov.addEventListener("change", e => {
      if (e.target.id === "gtfbReportType") {
        reportState.type = e.target.value;
        renderReports();
      }
      if (e.target.id === "gtfbReportState") {
        reportState.state = e.target.value;
        renderReports();
      }
      if (e.target.id === "gtfbReportSort") {
        reportState.sort = e.target.value;
        renderReports();
      }
      updatePreviews();
    });

    updatePreviews();
    return ov;
  }

  function updatePreviews() {
    const bug = qs("#gtfbBugPreview");
    const sug = qs("#gtfbSugPreview");
    if (bug) bug.textContent = reportBody("bug");
    if (sug) sug.textContent = reportBody("suggestion");
  }

  function renderReports() {
    const view = qs('[data-view="reports"]');
    if (!view) return;
    view.innerHTML = reportsHtml();
  }

  function setTab(tab) {
    activeTab = tab;
    const ov = ensureOverlay();

    qsa("[data-tab]", ov).forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    qsa("[data-view]", ov).forEach(v => v.classList.toggle("active", v.dataset.view === tab));

    if (tab === "reports") {
      renderReports();
      if (!issues.length) loadIssues(false);
    }

    if (tab === "status") {
      const v = qs('[data-view="status"]', ov);
      v.innerHTML = statusHtml();
      loadStatusBox();
    }
  }

  function open(tab = "bug") {
    ensureOverlay().classList.add("show");
    setTab(tab);
  }

  function close() {
    qs("#gtfbOverlay")?.classList.remove("show");
  }

  function start() {
    ensureButton();
    ensureOverlay();
    setTab("bug");

    const cached = readCache();
    if (cached) issues = cached;

    setTimeout(() => ensureButton(), 800);
    setTimeout(() => ensureButton(), 1800);

    const mo = new MutationObserver(() => {
      clearTimeout(window.__gtfbNavTimer);
      window.__gtfbNavTimer = setTimeout(ensureButton, 200);
    });

    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
    });

    window.GTNH_FEEDBACK = {
      open,
      close,
      openReports: () => open("reports"),
      refreshReports: () => loadIssues(true),
      getReports: () => issues.slice()
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
