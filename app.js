let grants = [];
let landscapeRows = [];
let sources = [];
let activeVerdict = "All";
let activeDeadline = "All";
let searchTerm = "";
let selectedName = "";

const INITIAL_GRANTS_TO_PURSUE = [
  "Community Foundation for Southeast Michigan - Community Impact Grants",
  "Project Lead The Way - STEM Grants",
  "W.K. Kellogg Foundation - Rolling LOI",
  "Ralph C. Wilson, Jr. Foundation - Foundation Grants",
];

const INITIAL_GRANT_NOTES = {
  "Community Foundation for Southeast Michigan - Community Impact Grants": "Best immediate deadline-driven fit for ELL, immigrant-family, literacy, and low-income student supports.",
  "Project Lead The Way - STEM Grants": "Clean school-accessible STEM pathway for New Dawn STEM Academy or another STEM-ready EMAN-supported school.",
  "W.K. Kellogg Foundation - Rolling LOI": "Strategic Michigan LOI for child, family, equity, immigrant-community, and low-income student success.",
  "Ralph C. Wilson, Jr. Foundation - Foundation Grants": "Southeast Michigan relationship play for afterschool, college/career readiness, teamwork, and youth success.",
};

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value).toLowerCase();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function verdictClass(verdict) {
  return normalize(verdict).replace(/[^a-z0-9]+/g, "-") || "maybe";
}

function displayDate(value) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  if (Number.isNaN(date.valueOf())) return clean(value) || "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function updateSyncStatus(message, state = "") {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}

function isInitialGrant(grant) {
  return INITIAL_GRANTS_TO_PURSUE.includes(clean(grant?.name));
}

function initialGrantRank(grant) {
  const index = INITIAL_GRANTS_TO_PURSUE.indexOf(clean(grant?.name));
  return index === -1 ? 99 : index;
}

function matchesSearch(grant) {
  if (!searchTerm) return true;
  return [
    grant.name,
    grant.tier,
    grant.size,
    grant.deadline,
    grant.eligible,
    grant.why,
    grant.requirements,
    grant.verdict,
    grant.status,
    grant.nextStep,
    isInitialGrant(grant) ? "initial grants to pursue priority slate" : "",
  ]
    .map(normalize)
    .join(" ")
    .includes(normalize(searchTerm));
}

function verdictRank(verdict) {
  return { Pursue: 0, Maybe: 1, Skip: 2 }[verdict] ?? 3;
}

function filteredGrants() {
  return [...grants]
    .sort((a, b) => initialGrantRank(a) - initialGrantRank(b) || verdictRank(a.verdict) - verdictRank(b.verdict) || clean(a.name).localeCompare(clean(b.name)))
    .filter((grant) => {
      const verdictMatch = activeVerdict === "All" || grant.verdict === activeVerdict;
      const deadlineMatch = activeDeadline === "All" || grant.dueFlag === activeDeadline;
      return verdictMatch && deadlineMatch && matchesSearch(grant);
    });
}

function renderMetrics() {
  const metrics = [
    ["Tracked", grants.length],
    ["Pursue", grants.filter((g) => g.verdict === "Pursue").length],
    ["Initial grants", grants.filter(isInitialGrant).length],
    ["Within 30 days", grants.filter((g) => clean(g.dueFlag).includes("30") || clean(g.dueFlag).includes("14")).length],
  ];

  document.getElementById("metrics").innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderFilters() {
  const verdicts = ["All", "Pursue", "Maybe", "Skip"];
  const deadlines = ["All", ...Array.from(new Set(grants.map((g) => g.dueFlag).filter(Boolean)))];

  document.getElementById("verdictFilters").innerHTML = verdicts
    .map((verdict) => `<button class="chip ${activeVerdict === verdict ? "active" : ""}" data-filter="verdict" data-value="${escapeHtml(verdict)}">${escapeHtml(verdict)}</button>`)
    .join("");

  document.getElementById("deadlineFilters").innerHTML = deadlines
    .map((deadline) => `<button class="chip ${activeDeadline === deadline ? "active" : ""}" data-filter="deadline" data-value="${escapeHtml(deadline)}">${escapeHtml(deadline)}</button>`)
    .join("");
}

function renderInitialPursuits() {
  const container = document.getElementById("initialPursuits");
  if (!container) return;

  const priorityGrants = grants.filter(isInitialGrant).sort((a, b) => initialGrantRank(a) - initialGrantRank(b));
  if (!priorityGrants.length) {
    container.innerHTML = `<p class="empty">Initial grants will appear after data.json loads.</p>`;
    return;
  }

  container.innerHTML = priorityGrants
    .map((grant, index) => {
      const sourceLink = grant.source
        ? `<a href="${escapeHtml(grant.source)}" target="_blank" rel="noreferrer">Application / guidelines</a>`
        : "";
      return `
        <article class="priority-card" data-name="${escapeHtml(grant.name)}">
          <span class="priority-number">${index + 1}</span>
          <div>
            <h3>${escapeHtml(grant.name)}</h3>
            <p>${escapeHtml(INITIAL_GRANT_NOTES[grant.name] || grant.why)}</p>
            <div class="priority-meta">
              <span>${escapeHtml(grant.deadline)}</span>
              ${sourceLink}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRows() {
  const rows = filteredGrants();
  const tbody = document.getElementById("grantRows");
  document.getElementById("resultCount").textContent = `${rows.length} of ${grants.length} shown`;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td class="empty" colspan="6">No grants match the current filters.</td></tr>`;
    renderDetail(null);
    return;
  }

  if (!rows.some((grant) => grant.name === selectedName)) selectedName = rows[0].name;

  tbody.innerHTML = rows
    .map((grant) => {
      const priorityBadge = isInitialGrant(grant) ? `<span class="priority-badge">Initial Grants to Pursue</span>` : "";
      return `
        <tr class="${grant.name === selectedName ? "selected" : ""} ${isInitialGrant(grant) ? "initial-pursuit-row" : ""}" data-name="${escapeHtml(grant.name)}">
          <td><span class="grant-name">${escapeHtml(grant.name)}</span>${priorityBadge}<span class="tier">${escapeHtml(grant.tier)}</span></td>
          <td>${escapeHtml(grant.size)}</td>
          <td>${escapeHtml(grant.deadline)}<span class="deadline-flag">${escapeHtml(grant.dueFlag)}</span></td>
          <td>${escapeHtml(isInitialGrant(grant) ? INITIAL_GRANT_NOTES[grant.name] || grant.why : grant.why)}</td>
          <td>${escapeHtml(grant.requirements)}</td>
          <td><span class="verdict ${verdictClass(grant.verdict)}">${escapeHtml(grant.verdict)}</span></td>
        </tr>
      `;
    })
    .join("");

  renderDetail(grants.find((grant) => grant.name === selectedName));
}

function renderDetail(grant) {
  const detail = document.getElementById("detail");
  if (!grant) {
    detail.innerHTML = `<p class="empty">Select a row to inspect the opportunity.</p>`;
    return;
  }

  const sourceLink = grant.source
    ? `<a class="source-link" href="${escapeHtml(grant.source)}" target="_blank" rel="noreferrer">Open application / guidelines</a>`
    : "";
  const priorityBadge = isInitialGrant(grant) ? `<span class="priority-badge detail-priority">Initial Grants to Pursue</span>` : "";

  detail.innerHTML = `
    <h2>${escapeHtml(grant.name)}</h2>
    ${priorityBadge}
    <span class="verdict ${verdictClass(grant.verdict)}">${escapeHtml(grant.verdict)}</span>
    <div class="detail-grid">
      <div class="detail-item"><span>Eligible applicant</span><p>${escapeHtml(grant.eligible)}</p></div>
      <div class="detail-item"><span>Why EMAN is a good fit</span><p>${escapeHtml(isInitialGrant(grant) ? INITIAL_GRANT_NOTES[grant.name] || grant.why : grant.why)}</p></div>
      <div class="detail-item"><span>Materiality</span><p>${escapeHtml(grant.materiality)}</p></div>
      <div class="detail-item"><span>Effort / odds</span><p>${escapeHtml(grant.effort)}; ${escapeHtml(grant.odds)}</p></div>
      <div class="detail-item"><span>Status</span><p>${escapeHtml(grant.status)}</p></div>
      <div class="detail-item"><span>Next step</span><p>${escapeHtml(grant.nextStep)}</p></div>
    </div>
    ${sourceLink}
  `;
}

function renderLandscape() {
  document.getElementById("landscape").innerHTML = landscapeRows.length
    ? landscapeRows
        .map(
          (row) => `
            <article class="landscape-row">
              <h3>${escapeHtml(row.segment)}</h3>
              <p><strong>${escapeHtml(row.materiality)}</strong></p>
              <p>${escapeHtml(row.evidence)}</p>
              <p>${escapeHtml(row.implication)}</p>
            </article>
          `,
        )
        .join("")
    : `<p class="empty">No landscape rows have been added yet.</p>`;
}

function renderSources() {
  document.getElementById("sources").innerHTML = sources.length
    ? sources
        .map(([name, url]) => `<article class="source-item"><h3>${escapeHtml(name)}</h3><p>Primary source used in the dashboard.</p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></article>`)
        .join("")
    : `<article class="source-item"><h3>No source links listed</h3><p>Sources will appear after the next grant scan updates data.json.</p></article>`;
}

function render(updatedAt) {
  const runDate = document.getElementById("runDate");
  if (runDate) runDate.textContent = displayDate(updatedAt);
  renderMetrics();
  renderFilters();
  renderInitialPursuits();
  renderRows();
  renderLandscape();
  renderSources();
}

async function loadDashboardData() {
  updateSyncStatus("Loading repo data...", "loading");
  try {
    const response = await fetch(`./data.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`data.json returned ${response.status}`);
    const data = await response.json();
    grants = Array.isArray(data.grants) ? data.grants : [];
    landscapeRows = Array.isArray(data.landscape) ? data.landscape : [];
    sources = Array.isArray(data.sources) ? data.sources : [];
    selectedName = grants.filter(isInitialGrant).sort((a, b) => initialGrantRank(a) - initialGrantRank(b))[0]?.name || grants[0]?.name || "";
    render(data.updatedAt);
    updateSyncStatus(`Loaded from data.json · ${new Date().toLocaleString()}`, "ok");
  } catch (error) {
    console.error(error);
    grants = [];
    landscapeRows = [];
    sources = [];
    render();
    updateSyncStatus("Could not load data.json", "error");
  }
}

document.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (chip) {
    if (chip.dataset.filter === "verdict") activeVerdict = chip.dataset.value;
    if (chip.dataset.filter === "deadline") activeDeadline = chip.dataset.value;
    render();
    return;
  }

  const priorityCard = event.target.closest(".priority-card[data-name]");
  if (priorityCard) {
    selectedName = priorityCard.dataset.name;
    searchTerm = "";
    const search = document.getElementById("search");
    if (search) search.value = "";
    renderRows();
    document.querySelector(".grant-table-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const row = event.target.closest("tbody tr[data-name]");
  if (row) {
    selectedName = row.dataset.name;
    renderRows();
  }
});

document.getElementById("search").addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderRows();
});

loadDashboardData();