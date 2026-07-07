let DATA = null;
let WEIGHTS = {};
let STATE = { search: "", area: "all", sort: "prob-desc" };

async function init() {
  const res = await fetch("data.json");
  if (!res.ok) {
    document.getElementById("app").innerHTML =
      '<p class="fetch-error">Could not load data.json — serve this over http:// (e.g. <code>python3 -m http.server</code>), not file://.</p>';
    return;
  }
  DATA = await res.json();
  DATA.framework.criteria.forEach((c) => (WEIGHTS[c.key] = 20));

  renderMeta();
  renderFramework();
  renderControls();
  renderList();
}

function renderMeta() {
  document.getElementById("eyebrow").textContent = "Clinical Trial Screening · Public Data Only";
  document.getElementById("title").textContent = DATA.meta.title;
  document.getElementById("subtitle").textContent = DATA.meta.subtitle;
  document.getElementById("asOf").textContent = "As of " + DATA.meta.asOf;
  document.getElementById("disclaimer").textContent = DATA.meta.disclaimer;
}

function compositeProbability(trial) {
  // Base rate anchors the estimate; each non-base-rate factor nudges it up/down from neutral (score 3),
  // scaled by that factor's share of the total weight. Weighting baseRate itself down dampens the anchor's influence.
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) || 1;
  const baseShare = WEIGHTS.baseRate / totalWeight;
  let adjustment = 0;
  DATA.framework.criteria.forEach((c) => {
    if (c.key === "baseRate") return;
    const share = WEIGHTS[c.key] / totalWeight;
    adjustment += share * ((trial.factorScores[c.key] - 3) * 0.08);
  });
  const anchored = trial.baseRate * (0.4 + 0.6 * baseShare) + adjustment;
  return Math.max(0.01, Math.min(0.95, anchored));
}

function renderFramework() {
  const root = document.getElementById("frameworkRoot");
  root.innerHTML = "";
  DATA.framework.criteria.forEach((c) => {
    const card = document.createElement("div");
    card.className = "crit-card";
    card.innerHTML = `
      <div class="crit-head">
        <span class="crit-label">${c.short}</span>
        <span class="crit-weight" id="weightLabel-${c.key}">20%</span>
      </div>
      <input type="range" min="0" max="100" value="20" class="crit-slider" id="slider-${c.key}" data-key="${c.key}">
      <p class="crit-desc">${c.description}</p>
    `;
    root.appendChild(card);
  });
  DATA.framework.criteria.forEach((c) => {
    document.getElementById(`slider-${c.key}`).addEventListener("input", (e) => {
      WEIGHTS[c.key] = Number(e.target.value);
      updateWeightLabels();
      renderList();
    });
  });
  updateWeightLabels();
}

function updateWeightLabels() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) || 1;
  DATA.framework.criteria.forEach((c) => {
    const pct = Math.round((WEIGHTS[c.key] / total) * 100);
    document.getElementById(`weightLabel-${c.key}`).textContent = pct + "%";
  });
}

function renderControls() {
  const areaSelect = document.getElementById("areaFilter");
  areaSelect.innerHTML =
    '<option value="all">All therapeutic areas</option>' +
    DATA.therapeuticAreas.map((a) => `<option value="${a}">${a}</option>`).join("");

  document.getElementById("searchInput").addEventListener("input", (e) => {
    STATE.search = e.target.value.toLowerCase();
    renderList();
  });
  areaSelect.addEventListener("change", (e) => {
    STATE.area = e.target.value;
    renderList();
  });
  document.getElementById("sortSelect").addEventListener("change", (e) => {
    STATE.sort = e.target.value;
    renderList();
  });
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  document.getElementById("drawerOverlay").addEventListener("click", closeDrawer);
}

function filteredTrials() {
  return DATA.trials.filter((t) => {
    if (STATE.search) {
      const hay = (t.title + " " + t.condition + " " + t.sponsor).toLowerCase();
      if (!hay.includes(STATE.search)) return false;
    }
    if (STATE.area !== "all" && t.therapeuticArea !== STATE.area) return false;
    return true;
  });
}

function sortedTrials(trials) {
  const withScore = trials.map((t) => ({ t, score: compositeProbability(t) }));
  switch (STATE.sort) {
    case "prob-desc": withScore.sort((a, b) => b.score - a.score); break;
    case "prob-asc": withScore.sort((a, b) => a.score - b.score); break;
    case "enrollment-desc": withScore.sort((a, b) => (b.t.enrollment || 0) - (a.t.enrollment || 0)); break;
  }
  return withScore;
}

function renderList() {
  const trials = filteredTrials();
  const ranked = sortedTrials(trials);
  renderStats(trials);

  const root = document.getElementById("listRoot");
  root.innerHTML = "";
  if (ranked.length === 0) {
    root.innerHTML = '<tr><td colspan="6" class="empty-state">No trials match these filters.</td></tr>';
    return;
  }
  ranked.forEach(({ t, score }) => {
    const cls = score >= 0.4 ? "hi" : score < 0.2 ? "lo" : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <span class="trial-name">${t.title}</span>
        <span class="trial-sub">${t.condition} · ${t.sponsor}</span>
      </td>
      <td><span class="area-badge area-${slug(t.therapeuticArea)}">${t.therapeuticArea}</span></td>
      <td>${t.phase}</td>
      <td>${t.enrollment ?? "—"}</td>
      <td class="mono">${t.nctId}</td>
      <td>
        <div class="score-cell">
          <div class="score-bar-track"><div class="score-bar-fill ${cls}" style="width:${score * 100}%"></div></div>
          <span class="score-num ${cls}">${(score * 100).toFixed(1)}%</span>
        </div>
      </td>
    `;
    row.addEventListener("click", () => openDrawer(t, score));
    root.appendChild(row);
  });
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

function renderStats(trials) {
  const root = document.getElementById("statsRoot");
  const total = trials.length;
  const avgProb = total ? trials.reduce((sum, t) => sum + compositeProbability(t), 0) / total : 0;
  const areas = new Set(trials.map((t) => t.therapeuticArea)).size;
  const totalEnrollment = trials.reduce((sum, t) => sum + (t.enrollment || 0), 0);
  root.innerHTML = `
    <div class="stat-box"><span class="stat-num">${total}</span><span class="stat-label">Trials shown</span></div>
    <div class="stat-box"><span class="stat-num">${areas}</span><span class="stat-label">Therapeutic areas</span></div>
    <div class="stat-box"><span class="stat-num">${totalEnrollment.toLocaleString()}</span><span class="stat-label">Total enrollment</span></div>
    <div class="stat-box"><span class="stat-num">${(avgProb * 100).toFixed(1)}%</span><span class="stat-label">Avg. adjusted probability</span></div>
  `;
}

function radarSVG(trial) {
  const SIZE = 240, CX = SIZE / 2, CY = SIZE / 2, R = 82;
  const criteria = DATA.framework.criteria;
  const n = criteria.length;
  const point = (i, r) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
  };
  const ring = (r) => Array.from({ length: n }, (_, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");
  const rings = [R, R * 0.66, R * 0.33].map((r) => `<polygon points="${ring(r)}" fill="none" stroke="#262b26" stroke-width="1"/>`).join("");
  const axes = Array.from({ length: n }, (_, i) => {
    const [x, y] = point(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#3a423a" stroke-width="1"/>`;
  }).join("");
  const getScore = (c) => (c.key === "baseRate" ? Math.round(trial.baseRate * 5 / 0.6) : trial.factorScores[c.key]);
  const dataPoints = criteria.map((c, i) => point(i, (Math.min(5, getScore(c)) / 5) * R));
  const shape = dataPoints.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  const dots = dataPoints.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#3ddc84"/>`).join("");
  const labels = criteria.map((c, i) => {
    const [x, y] = point(i, R + 16);
    let anchor = "middle";
    if (x > CX + 8) anchor = "start"; else if (x < CX - 8) anchor = "end";
    const dy = y > CY + 8 ? 8 : y < CY - 8 ? 0 : 4;
    return `<text x="${x.toFixed(1)}" y="${(y + dy).toFixed(1)}" fill="#7c877c" font-size="9" font-family="SF Mono, Menlo, Consolas, monospace" text-anchor="${anchor}" letter-spacing="0.05em">${c.short.toUpperCase()}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${rings}${axes}<polygon points="${shape}" fill="#3ddc84" fill-opacity="0.18" stroke="#3ddc84" stroke-width="2"/>${dots}${labels}</svg>`;
}

function openDrawer(trial, score) {
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("drawerOverlay");
  const body = document.getElementById("drawerBody");

  const critRows = DATA.framework.criteria.map((c) => {
    const isBase = c.key === "baseRate";
    const note = isBase ? `Published rate: ${(trial.baseRate * 100).toFixed(1)}% — source: ${trial.baseRateSource}` : trial.factorNotes[c.key];
    const s = isBase ? Math.round(trial.baseRate * 5 / 0.6) : trial.factorScores[c.key];
    return `
      <div class="drawer-crit">
        <div class="drawer-crit-head"><span>${c.label}</span><span class="drawer-crit-score">${Math.min(5,s)}/5</span></div>
        <div class="score-bar-track"><div class="score-bar-fill hi" style="width:${Math.min(5,s)/5*100}%"></div></div>
        <p class="drawer-crit-rationale">${note}</p>
      </div>`;
  }).join("");

  body.innerHTML = `
    <div class="drawer-badge area-${slug(trial.therapeuticArea)}">${trial.therapeuticArea}</div>
    <h2 class="drawer-title">${trial.title}</h2>
    <p class="drawer-sub">${trial.condition} · ${trial.phase} · ${trial.nctId}</p>
    <div class="drawer-radar">${radarSVG(trial)}</div>
    <div class="drawer-financials">
      <div><span class="drawer-fin-label">Sponsor</span><span class="drawer-fin-val">${trial.sponsor}</span></div>
      <div><span class="drawer-fin-label">Sponsor type</span><span class="drawer-fin-val">${trial.sponsorTier}</span></div>
      <div><span class="drawer-fin-label">Enrollment target</span><span class="drawer-fin-val">${trial.enrollment ?? "—"}</span></div>
      <div><span class="drawer-fin-label">Competing trials</span><span class="drawer-fin-val">${trial.competitiveTrialCount ?? "—"}</span></div>
      <div><span class="drawer-fin-label">Start date</span><span class="drawer-fin-val">${trial.startDate || "—"}</span></div>
      <div><span class="drawer-fin-label">Adjusted probability</span><span class="drawer-fin-val">${(score * 100).toFixed(1)}%</span></div>
    </div>
    <div class="drawer-note"><strong>ClinicalTrials.gov:</strong> <a href="https://clinicaltrials.gov/study/${trial.nctId}" target="_blank" rel="noopener">${trial.nctId} →</a></div>
    <h3 class="drawer-section-head">Score breakdown</h3>
    ${critRows}
  `;
  drawer.classList.add("open");
  overlay.classList.add("open");
}

function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("drawerOverlay").classList.remove("open");
}

init();
