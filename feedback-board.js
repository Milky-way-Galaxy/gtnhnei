/* === GTNH Workbench Public Reports Board v1 === */
(() => {
  "use strict";

  if (window.__GTNH_REPORTS_BOARD_V1__) return;
  window.__GTNH_REPORTS_BOARD_V1__ = true;

  const REPO = "milky-way-galaxy/gtnhnei";
  const API = `https://api.github.com/repos/${REPO}`;
  const ISSUES_URL = `https://github.com/${REPO}/issues`;
  const REPORT_CACHE_KEY = "gtnh_reports_cache_v1";
  const REPORT_CACHE_MS = 2 * 60 * 1000;

  let reports = [];
  let loading = false;
  let lastError = "";
  let active = false;

  const state = {
    query: "",
    type: "all",
    issueState: "all",
    status: "all",
    sort: "priority"
  };

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

  function formatDate(raw) {
    if (!raw) return "unknown";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "unknown";

    const now = Date.now();
    const diff = now - d.getTime();
    const min = 60 * 1000;
    const hour = 60 * min;
    const day = 24 * hour;

    if (diff < hour) return `${Math.max(1, Math.round(diff / min))}m ago`;
    if (diff < day) return `${Math.round(diff / hour)}h ago`;
    if (diff < 14 * day) return `${Math.round(diff / day)}d ago`;

    return d.toISOString().slice(0, 10);
  }

  function stripMd(md) {
    return text(String(md || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/[#>*_\-]+/g, " ")
      .replace(/\|/g, " "));
  }

  function labelsOf(issue) {
    return (issue.labels || []).map(x => typeof x === "string" ? x : x.name).filter(Boolean);
  }

  function labelSlug(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function hasLabel(issue, wanted) {
    const w = wanted.toLowerCase();
    return labelsOf(issue).some(x => x.toLowerCase() === w);
  }

  function labelStarts(issue, prefix) {
    const p = prefix.toLowerCase();
    return labelsOf(issue).find(x => x.toLowerCase().startsWith(p)) || "";
  }

  function reportType(issue) {
    const title = issue.title || "";
    const labs = labelsOf(issue).map(x => x.toLowerCase());

    if (labs.includes("bug") || /^\s*\[bug\]/i.test(title)) return "bug";
    if (labs.includes("enhancement") || labs.includes("suggestion") || /^\s*\[suggestion\]/i.test(title)) return "suggestion";
    return "report";
  }

  function reportStatus(issue) {
    const explicit =
      labelStarts(issue, "status:") ||
      labelsOf(issue).find(x => /^(fixed|done|changed|planned|investigating|not doing|implemented differently)$/i.test(x));

    if (explicit) {
      return explicit.replace(/^status:/i, "").trim();
    }

    return issue.state === "closed" ? "closed" : "open";
  }

  function reportArea(issue) {
    const area = labelStarts(issue, "area:");
    if (area) return area.replace(/^area:/i, "").trim();
    return "general";
  }

  function votesOf(issue) {
    const r = issue.reactions || {};
    return Number(r["+1"] || 0);
  }

  function priorityScore(issue) {
    return (
      votesOf(issue) * 1000 +
      Number(issue.comments || 0) * 35 +
      (issue.state === "open" ? 20 : 0) +
      (reportType(issue) === "bug" ? 12 : 0)
    );
  }

  function saveCache(data) {
    try {
      localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify({
        t: Date.now(),
        data
      }));
    } catch {}
  }

  function readCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(REPORT_CACHE_KEY) || "null");
      if (!raw || !Array.isArray(raw.data)) return null;
      if (Date.now() - raw.t > REPORT_CACHE_MS) return null;
      return raw.data;
    } catch {
      return null;
    }
  }

  async function fetchIssuesPage(page) {
    const url = `${API}/issues?state=all&per_page=100&page=${page}&sort=updated&direction=desc`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json"
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }

    return await res.json();
  }

  async function loadReports(force = false) {
    if (loading) return;

    lastError = "";

    if (!force) {
      const cached = readCache();
      if (cached) {
        reports = cached;
        renderReports();
      }
    }

    loading = true;
    renderReports();

    try {
      const all = [];
      for (let page = 1; page <= 3; page++) {
        const chunk = await fetchIssuesPage(page);
        const issuesOnly = chunk.filter(x => !x.pull_request);
        all.push(...issuesOnly);

        if (chunk.length < 100) break;
      }

      reports = all;
      saveCache(all);
    } catch (err) {
      lastError = String(err?.message || err || "unknown error");
    } finally {
      loading = false;
      renderReports();
    }
  }

  function filteredReports() {
    const q = state.query.trim().toLowerCase();

    let out = reports.slice();

    if (state.type !== "all") {
      out = out.filter(x => reportType(x) === state.type);
    }

    if (state.issueState !== "all") {
      out = out.filter(x => x.state === state.issueState);
    }

    if (state.status !== "all") {
      out = out.filter(x => labelSlug(reportStatus(x)) === labelSlug(state.status));
    }

    if (q) {
      out = out.filter(issue => {
        const hay = [
          issue.title,
          issue.number,
          issue.user?.login,
          stripMd(issue.body),
          labelsOf(issue).join(" "),
          reportArea(issue),
          reportStatus(issue),
          reportType(issue)
        ].join(" ").toLowerCase();

        return hay.includes(q);
      });
    }

    if (state.sort === "priority") {
      out.sort((a, b) => priorityScore(b) - priorityScore(a) || new Date(b.updated_at) - new Date(a.updated_at));
    } else if (state.sort === "votes") {
      out.sort((a, b) => votesOf(b) - votesOf(a) || new Date(b.updated_at) - new Date(a.updated_at));
    } else if (state.sort === "newest") {
      out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (state.sort === "updated") {
      out.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    } else if (state.sort === "comments") {
      out.sort((a, b) => Number(b.comments || 0) - Number(a.comments || 0));
    }

    return out;
  }

  function renderLabels(issue) {
    const labels = labelsOf(issue);

    const extra = [
      reportType(issue),
      issue.state,
      reportStatus(issue) !== issue.state ? reportStatus(issue) : ""
    ].filter(Boolean);

    const unique = [...new Set([...extra, ...labels])].slice(0, 12);

    return `
      <div class="gtnhReportLabels">
        ${unique.map(l => `
          <span class="gtnhReportLabel ${esc(labelSlug(l))}">${esc(l)}</span>
        `).join("")}
      </div>
    `;
  }

  function renderReportCard(issue) {
    const type = reportType(issue);
    const status = reportStatus(issue);
    const area = reportArea(issue);
    const votes = votesOf(issue);
    const body = stripMd(issue.body).slice(0, 260);

    return `
      <article class="gtnhReportCard ${type === "bug" ? "isBug" : ""} ${type === "suggestion" ? "isSuggestion" : ""} ${issue.state === "closed" ? "isClosed" : ""}">
        <div class="gtnhReportTop">
          <div>
            <h3 class="gtnhReportTitle">
              <a href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">
                <span class="gtnhReportNumber">#${esc(issue.number)}</span>
                ${esc(issue.title || "Untitled report")}
              </a>
            </h3>
            <div class="gtnhReportBody">
              ${body ? esc(body) : "<i>No description.</i>"}
            </div>
          </div>

          <div class="gtnhReportVotes">
            <span class="gtnhReportVoteBadge">👍 ${votes}</span>
            <a class="gtnhReportVoteButton" href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">
              Vote on GitHub
            </a>
          </div>
        </div>

        ${renderLabels(issue)}

        <div class="gtnhReportFoot">
          <span>
            ${esc(type)} · ${esc(area)} · ${esc(status)}
            · ${Number(issue.comments || 0)} comment(s)
            · updated ${esc(formatDate(issue.updated_at))}
          </span>
          <a href="${esc(issue.html_url)}" target="_blank" rel="noopener noreferrer">Open report</a>
        </div>
      </article>
    `;
  }

  function reportsViewHtml() {
    const openCount = reports.filter(x => x.state === "open").length;
    const closedCount = reports.filter(x => x.state === "closed").length;
    const bugCount = reports.filter(x => reportType(x) === "bug").length;
    const sugCount = reports.filter(x => reportType(x) === "suggestion").length;

    const shown = filteredReports();

    return `
      <section class="gtnhFeedbackCard">
        <h3>Public reports</h3>

        <div class="gtnhReportsHelp">
          <h3>How priority works</h3>
          <p>Reports and suggestions are public GitHub issues. To vote, open the report and press GitHub's <code>👍</code> reaction. The website reads that count and sorts by priority.</p>
          <p>Official status still comes from maintainer labels/status updates, not random comments.</p>

          <div class="gtnhReportsMiniActions">
            <a href="${ISSUES_URL}" target="_blank" rel="noopener noreferrer">Open all GitHub issues</a>
            <a href="${ISSUES_URL}?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc" target="_blank" rel="noopener noreferrer">Most upvoted on GitHub</a>
          </div>
        </div>

        <div class="gtnhReportsToolbar">
          <input id="gtnhReportsSearch" type="search" placeholder="Search reports, bugs, suggestions, labels..." value="${esc(state.query)}">

          <select id="gtnhReportsType">
            <option value="all" ${state.type === "all" ? "selected" : ""}>All types</option>
            <option value="bug" ${state.type === "bug" ? "selected" : ""}>Bugs</option>
            <option value="suggestion" ${state.type === "suggestion" ? "selected" : ""}>Suggestions</option>
            <option value="report" ${state.type === "report" ? "selected" : ""}>Other reports</option>
          </select>

          <select id="gtnhReportsState">
            <option value="all" ${state.issueState === "all" ? "selected" : ""}>Open + closed</option>
            <option value="open" ${state.issueState === "open" ? "selected" : ""}>Open only</option>
            <option value="closed" ${state.issueState === "closed" ? "selected" : ""}>Closed only</option>
          </select>

          <select id="gtnhReportsSort">
            <option value="priority" ${state.sort === "priority" ? "selected" : ""}>Priority</option>
            <option value="votes" ${state.sort === "votes" ? "selected" : ""}>Most liked</option>
            <option value="updated" ${state.sort === "updated" ? "selected" : ""}>Recently updated</option>
            <option value="newest" ${state.sort === "newest" ? "selected" : ""}>Newest</option>
            <option value="comments" ${state.sort === "comments" ? "selected" : ""}>Most discussed</option>
          </select>

          <select id="gtnhReportsStatus">
            <option value="all" ${state.status === "all" ? "selected" : ""}>Any status</option>
            <option value="open" ${state.status === "open" ? "selected" : ""}>Open</option>
            <option value="closed" ${state.status === "closed" ? "selected" : ""}>Closed</option>
            <option value="fixed" ${state.status === "fixed" ? "selected" : ""}>Fixed</option>
            <option value="done" ${state.status === "done" ? "selected" : ""}>Done</option>
            <option value="changed" ${state.status === "changed" ? "selected" : ""}>Changed</option>
            <option value="planned" ${state.status === "planned" ? "selected" : ""}>Planned</option>
            <option value="investigating" ${state.status === "investigating" ? "selected" : ""}>Investigating</option>
            <option value="not-doing" ${state.status === "not-doing" ? "selected" : ""}>Not doing</option>
          </select>

          <button id="gtnhReportsRefresh" type="button">Refresh</button>
        </div>

        <div class="gtnhReportsMeta">
          <span><b>${shown.length}</b> shown</span>
          <span><b>${reports.length}</b> loaded</span>
          <span><b>${openCount}</b> open</span>
          <span><b>${closedCount}</b> closed</span>
          <span><b>${bugCount}</b> bugs</span>
          <span><b>${sugCount}</b> suggestions</span>
        </div>

        <div id="gtnhReportsList" class="gtnhReportsList">
          ${
            loading && !reports.length
              ? `<div class="gtnhReportsLoading">Loading public reports from GitHub...</div>`
              : lastError
                ? `<div class="gtnhReportsError">Could not load GitHub issues: ${esc(lastError)}<br>GitHub API rate limit or network failure is possible. Try Refresh later.</div>`
                : shown.length
                  ? shown.map(renderReportCard).join("")
                  : `<div class="gtnhReportsEmpty">No reports match this filter.</div>`
          }
        </div>
      </section>
    `;
  }

  function ensureReportsTab() {
    const overlay = qs("#gtnhFeedbackOverlay");
    if (!overlay) return false;

    const tabs = qs(".gtnhFeedbackTabs", overlay);
    const body = qs(".gtnhFeedbackBody", overlay);
    if (!tabs || !body) return false;

    if (!qs('[data-feedback-tab="reports"]', tabs)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.feedbackTab = "reports";
      btn.textContent = "Reports / votes";
      tabs.appendChild(btn);
    }

    let view = qs('[data-feedback-view="reports"]', body);
    if (!view) {
      view = document.createElement("div");
      view.className = "gtnhFeedbackView";
      view.dataset.feedbackView = "reports";
      body.appendChild(view);
    }

    const btn = qs('[data-feedback-tab="reports"]', tabs);

    if (btn && btn.dataset.gtnhReportsBound !== "1") {
      btn.dataset.gtnhReportsBound = "1";
      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        qsa("[data-feedback-tab]", tabs).forEach(x => x.classList.toggle("active", x === btn));
        qsa("[data-feedback-view]", body).forEach(x => x.classList.toggle("active", x.dataset.feedbackView === "reports"));

        active = true;
        renderReports();

        if (!reports.length) loadReports(false);
      });
    }

    return true;
  }

  function bindReportControls(root) {
    const search = qs("#gtnhReportsSearch", root);
    const type = qs("#gtnhReportsType", root);
    const issueState = qs("#gtnhReportsState", root);
    const sort = qs("#gtnhReportsSort", root);
    const status = qs("#gtnhReportsStatus", root);
    const refresh = qs("#gtnhReportsRefresh", root);

    if (search && search.dataset.bound !== "1") {
      search.dataset.bound = "1";
      search.addEventListener("input", () => {
        state.query = search.value;
        renderReports();
      });
    }

    if (type && type.dataset.bound !== "1") {
      type.dataset.bound = "1";
      type.addEventListener("change", () => {
        state.type = type.value;
        renderReports();
      });
    }

    if (issueState && issueState.dataset.bound !== "1") {
      issueState.dataset.bound = "1";
      issueState.addEventListener("change", () => {
        state.issueState = issueState.value;
        renderReports();
      });
    }

    if (sort && sort.dataset.bound !== "1") {
      sort.dataset.bound = "1";
      sort.addEventListener("change", () => {
        state.sort = sort.value;
        renderReports();
      });
    }

    if (status && status.dataset.bound !== "1") {
      status.dataset.bound = "1";
      status.addEventListener("change", () => {
        state.status = status.value;
        renderReports();
      });
    }

    if (refresh && refresh.dataset.bound !== "1") {
      refresh.dataset.bound = "1";
      refresh.addEventListener("click", () => loadReports(true));
    }
  }

  function renderReports() {
    const overlay = qs("#gtnhFeedbackOverlay");
    const view = overlay?.querySelector('[data-feedback-view="reports"]');
    if (!view) return;

    const oldScroll = view.closest(".gtnhFeedbackBody")?.scrollTop || 0;
    view.innerHTML = reportsViewHtml();
    bindReportControls(view);

    const body = view.closest(".gtnhFeedbackBody");
    if (body && active) body.scrollTop = Math.min(oldScroll, body.scrollHeight);
  }

  function patchOpenApi() {
    const old = window.GTNH_FEEDBACK || {};
    window.GTNH_FEEDBACK = Object.assign(old, {
      openReports() {
        const opened = old.open ? old.open("bug") : null;

        setTimeout(() => {
          ensureReportsTab();
          const overlay = qs("#gtnhFeedbackOverlay");
          const btn = overlay?.querySelector('[data-feedback-tab="reports"]');
          btn?.click();
        }, 80);

        return opened;
      },
      refreshReports() {
        return loadReports(true);
      },
      getReports() {
        return reports.slice();
      }
    });
  }

  function addQuickLinkToNotice() {
    const notice = qs("#gtnhFeedbackNotice");
    if (!notice || qs("[data-feedback-open-reports]", notice)) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.feedbackOpenReports = "1";
    btn.textContent = "Reports";
    btn.addEventListener("click", () => window.GTNH_FEEDBACK?.openReports?.());
    notice.appendChild(btn);
  }

  function start() {
    ensureReportsTab();
    patchOpenApi();

    const mo = new MutationObserver(() => {
      clearTimeout(window.__gtnhReportsBoardTimer);
      window.__gtnhReportsBoardTimer = setTimeout(() => {
        ensureReportsTab();
        patchOpenApi();
        addQuickLinkToNotice();
      }, 120);
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    const cached = readCache();
    if (cached) {
      reports = cached;
      renderReports();
    }

    // Lazy-load: only when panel exists/opened, but prefetch lightly after page settles.
    setTimeout(() => {
      if (!reports.length) loadReports(false);
    }, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
