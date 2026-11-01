(function () {
  const { createSeed, HOOKS, GRADES, OVERLAYS, PLATFORMS } = window.RelayData;
  const STORAGE_KEY = "relay-demo-state-v1";
  const CHART = "#e25b2a";

  const COPY = {
    overview: ["Overview", "Performance across every connected account."],
    accounts: ["Accounts", "Every channel this workspace can schedule."],
    library: ["Library", "Source clips, with the numbers attached."],
    variants: ["Variants", "New hooks and grades from posts that already work."],
    schedule: ["Schedule", "What is queued, and what already went out."],
    analytics: ["Analytics", "Views, CPM, and engagement in one place."],
  };

  const ui = {
    view: "overview",
    query: "",
    accountFilter: "all",
    libraryFilter: "all",
    range: "28d",
    scheduleDay: "",
    sortKey: "views7d",
    sortDir: "desc",
    selectedClip: null,
    prefillClip: null,
    draft: null,
    generating: null,
    genTimer: null,
  };

  let state = loadState();
  let toastTimer = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSeed();
      const parsed = JSON.parse(raw);
      if (!parsed.accounts || !parsed.clips || !parsed.variants || !parsed.queue) return createSeed();
      return parsed;
    } catch (err) {
      return createSeed();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 8);
  }

  function compact(n) {
    const value = Number(n) || 0;
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    const units = [["B", 1e9], ["M", 1e6], ["K", 1e3]];
    for (const [suffix, size] of units) {
      if (abs >= size) {
        const scaled = Math.round((abs / size) * 10) / 10;
        return sign + String(scaled).replace(/\.0$/, "") + suffix;
      }
    }
    return sign + Math.round(abs).toLocaleString("en-US");
  }

  function formatKind(kind, value) {
    if (kind === "compact") return compact(value);
    if (kind === "money") return "$" + Number(value).toFixed(2);
    if (kind === "percent") return Number(value).toFixed(1) + "%";
    return Math.round(Number(value) || 0).toLocaleString("en-US");
  }

  function signedPct(n) {
    const up = n >= 0;
    return `<span class="${up ? "up" : "down"}">${up ? "↑" : "↓"} ${Math.abs(n).toFixed(1)}%</span>`;
  }

  function sum(list) {
    return list.reduce((total, value) => total + value, 0);
  }

  function accountById(id) {
    return state.accounts.find((account) => account.id === id) || null;
  }

  function clipById(id) {
    return state.clips.find((clip) => clip.id === id) || null;
  }

  function views7d() {
    return state.accounts.reduce((total, account) => total + account.views7d, 0);
  }

  function weightedEngagement() {
    const rows = state.accounts.filter((account) => account.views7d > 0);
    const views = rows.reduce((total, account) => total + account.views7d, 0);
    if (!views) return 0;
    return rows.reduce((total, account) => total + account.engagement * account.views7d, 0) / views;
  }

  function queuedCount() {
    return state.queue.filter((item) => item.status === "scheduled").length;
  }

  function dayKey(input) {
    const date = input instanceof Date ? input : new Date(input);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function startOfDay(input) {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDay(input) {
    const date = input instanceof Date ? input : new Date(input);
    const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${formatDay(date)} · ${time}`;
  }

  function ago(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 36) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  function icon(name) {
    const paths = {
      search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
      x: '<path d="M7 7l10 10M17 7L7 17"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function chip(platform) {
    const meta = PLATFORMS[platform];
    if (!meta) return "";
    return `<span class="pchip p-${platform}">${meta.short}</span>`;
  }

  function thumb(clip) {
    const account = accountById(clip.accountId);
    const brand = account ? account.brand : clip.brand;
    return `<div class="thumb" style="--h:${Number(clip.hue) || 24}">
      <span class="thumb-brand">${esc(brand)}</span>
      <span class="thumb-time">${esc(clip.duration)}</span>
    </div>`;
  }

  function makeSeries(n, seed) {
    let x = seed % 2147483646;
    if (x <= 0) x = 1;
    const out = [];
    for (let i = 0; i < n; i += 1) {
      x = (x * 48271) % 2147483647;
      const noise = (x / 2147483647 - 0.5) * 0.08;
      const trend = 0.9 + (0.18 * i) / Math.max(1, n - 1);
      const wave = Math.sin(i / 2.4) * 0.05 + Math.sin(i / 5.5) * 0.035;
      out.push(Math.max(0.2, trend + wave + noise));
    }
    return out;
  }

  function viewsSeries(n) {
    const shape = makeSeries(n, 120 + n);
    const actual = views7d() || 1;
    const windowSize = Math.min(7, n);
    const last = sum(shape.slice(-windowSize));
    const scale = actual / last;
    return shape.map((value) => value * scale);
  }

  function seriesDelta(values) {
    const mid = Math.floor(values.length / 2);
    const first = sum(values.slice(0, mid));
    const second = sum(values.slice(mid));
    if (!first) return 0;
    return ((second - first) / first) * 100;
  }

  function dateLabels(n) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dates = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    return dates;
  }

  function areaChart(values, label) {
    const w = 640;
    const h = 210;
    const pad = 12;
    const max = Math.max(...values) * 1.08;
    const min = Math.min(...values) * 0.86;
    const span = Math.max(1, max - min);
    const step = (w - pad * 2) / Math.max(1, values.length - 1);
    const points = values.map((value, index) => {
      const x = pad + index * step;
      const y = pad + (1 - (value - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
    const area = `${line} L${points[points.length - 1][0].toFixed(1)},${h - 4} L${points[0][0].toFixed(1)},${h - 4} Z`;
    const last = points[points.length - 1];
    let grid = "";
    for (let i = 0; i < 3; i += 1) {
      const y = pad + ((h - pad * 2) / 2) * i;
      grid += `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="rgba(26,28,25,0.08)"/>`;
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${CHART}" stop-opacity="0.28"/>
          <stop offset="1" stop-color="${CHART}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path class="chart-area" d="${area}" fill="url(#areaFill)"></path>
      <path class="chart-line" d="${line}" fill="none" stroke="${CHART}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"></path>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5" fill="${CHART}"></circle>
    </svg>`;
  }

  function axisHtml(dates) {
    const picks = [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates[dates.length - 1]];
    return `<div class="axis">${picks.map((date) => `<span>${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>`).join("")}</div>`;
  }

  function chartBlock(n, title) {
    const series = viewsSeries(n);
    const dates = dateLabels(n);
    return `<div class="card-head">
        <div>
          <h2>${compact(sum(series))}</h2>
          <p class="muted">${esc(title)}</p>
        </div>
        ${signedPct(seriesDelta(series))}
      </div>
      ${areaChart(series, title)}
      ${axisHtml(dates)}`;
  }

  function empty(title, copy) {
    return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
  }

  function platformItems() {
    return [{ id: "all", label: "All" }].concat(
      Object.entries(PLATFORMS).map(([id, meta]) => ({ id, label: meta.label }))
    );
  }

  function chipRow(action, current) {
    return `<div class="chips">${platformItems().map((item) => {
      const on = item.id === current ? " on" : "";
      return `<button type="button" class="chip${on}" data-action="${action}" data-filter="${item.id}">${esc(item.label)}</button>`;
    }).join("")}</div>`;
  }

  function searchBox(placeholder) {
    return `<label class="search">${icon("search")}<input id="search" type="search" placeholder="${esc(placeholder)}" value="${esc(ui.query)}" autocomplete="off"></label>`;
  }

  function selectedClip() {
    return clipById(ui.selectedClip)
      || state.clips.slice().sort((a, b) => b.views - a.views)[0]
      || null;
  }

  function liveAccountFor(clip) {
    const own = clip ? accountById(clip.accountId) : null;
    if (own && own.status === "live") return own;
    return state.accounts.find((account) => account.status === "live") || null;
  }

  function renderOverview() {
    const engagement = weightedEngagement();
    const queued = queuedCount();
    const series = viewsSeries(14);
    const scaling = state.clips.slice().sort((a, b) => b.views - a.views).slice(0, 4);
    const pulse = state.accounts.slice().sort((a, b) => b.growth - a.growth).slice(0, 6);
    const autopilot = state.accounts.filter((account) => account.autopilot);
    const upcoming = state.queue
      .filter((item) => item.status === "scheduled")
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .slice(0, 4);

    const scaleRows = scaling.map((clip) => {
      const account = accountById(clip.accountId);
      return `<button type="button" class="scale-row" data-action="open-clip" data-id="${clip.id}">
        ${thumb(clip)}
        <span><strong class="clamp">${esc(clip.title)}</strong><span class="fine">${esc(clip.hook)}</span></span>
        <span><strong>${compact(clip.views)}</strong><span class="fine">${account ? PLATFORMS[account.platform].label : ""}</span></span>
      </button>`;
    }).join("");

    const pulseRows = pulse.map((account) => `<button type="button" class="mini-row" data-action="jump-platform" data-platform="${account.platform}">
      ${chip(account.platform)}
      <span><strong>${esc(account.brand)}</strong><span class="fine">@${esc(account.handle)}</span></span>
      ${signedPct(account.growth)}
    </button>`).join("");

    const autoRows = autopilot.slice(0, 4).map((account) => `<div class="mini-row">
      ${chip(account.platform)}
      <span><strong>${esc(account.brand)}</strong><span class="fine">${esc(PLATFORMS[account.platform].label)}</span></span>
      <span class="fine">${compact(account.views7d)}</span>
    </div>`).join("");

    const upcomingCards = upcoming.length
      ? upcoming.map((item) => {
        const clip = clipById(item.clipId);
        const account = accountById(item.accountId);
        return `<button type="button" class="card upcoming-card" data-action="nav" data-nav="schedule">
          <span class="fine">${esc(formatWhen(item.at))}</span>
          <strong class="clamp">${esc(clip ? clip.title : "Scheduled post")}</strong>
          <span class="muted">${account ? `${esc(PLATFORMS[account.platform].label)} · @${esc(account.handle)}` : "Unassigned"}</span>
        </button>`;
      }).join("")
      : `<div class="card empty"><h3>Queue is clear</h3><p>Schedule a clip when you want the next post lined up.</p></div>`;

    return `<div class="stack">
      <section class="kpis rise" style="--d:0">
        <article class="card kpi">
          <div class="label">Views · 7 days</div>
          <div class="value" data-count="${views7d()}" data-kind="compact">${compact(views7d())}</div>
          <div class="kpi-foot">${signedPct(seriesDelta(series))} <span>vs the prior stretch</span></div>
        </article>
        <article class="card kpi">
          <div class="label">Avg. CPM</div>
          <div class="value" data-count="0.17" data-kind="money">$0.17</div>
          <div class="kpi-foot">Blended across live accounts</div>
        </article>
        <article class="card kpi">
          <div class="label">Engagement</div>
          <div class="value" data-count="${engagement}" data-kind="percent">${engagement.toFixed(1)}%</div>
          <div class="kpi-foot">Weighted by views</div>
        </article>
        <article class="card kpi">
          <div class="label">In queue</div>
          <div class="value" data-count="${queued}" data-kind="int">${queued.toLocaleString("en-US")}</div>
          <div class="kpi-foot">Scheduled, not yet posted</div>
        </article>
      </section>
      <section class="split rise" style="--d:1">
        <article class="card">${chartBlock(14, "Views · last 14 days")}</article>
        <article class="card" style="display:flex;flex-direction:column">
          <div class="card-head">
            <h2>Autopilot</h2>
            <span class="pill good">${autopilot.length ? `On · ${autopilot.length}` : "Off"}</span>
          </div>
          <p class="muted" style="margin:8px 0 12px">${autopilot.length
            ? "New variants lean toward hooks and grades already in the top quartile."
            : "Turn Autopilot on for an account when you want performance to pick the next variants."}</p>
          <div>${autoRows || ""}</div>
          <button type="button" class="btn btn-ghost btn-block push" data-action="nav" data-nav="accounts">Review accounts</button>
        </article>
      </section>
      <section class="split rise" style="--d:2">
        <article class="card">
          <div class="card-head"><h2>Scaling</h2><button type="button" class="link" data-action="nav" data-nav="library">Open library</button></div>
          <div style="margin-top:8px">${scaleRows || empty("No clips yet", "Add a source clip to start the loop.")}</div>
        </article>
        <article class="card">
          <div class="card-head"><h2>Account pulse</h2></div>
          <div style="margin-top:8px">${pulseRows}</div>
        </article>
      </section>
      <section class="rise" style="--d:3">
        <div class="section-label">
          <h2>Up next</h2>
          <button type="button" class="link" data-action="nav" data-nav="schedule">Open schedule</button>
        </div>
        <div class="upcoming">${upcomingCards}</div>
      </section>
    </div>`;
  }

  function renderAccounts() {
    const q = ui.query.trim().toLowerCase();
    const list = state.accounts.filter((account) => {
      if (ui.accountFilter !== "all" && account.platform !== ui.accountFilter) return false;
      if (!q) return true;
      const hay = `${account.brand} ${account.handle} ${PLATFORMS[account.platform].label}`.toLowerCase();
      return hay.includes(q);
    });
    const cards = list.map((account) => `<article class="card account-card ${account.status}">
      <div class="account-top">
        ${chip(account.platform)}
        <span class="status ${account.status}"><i class="dot"></i>${account.status === "live" ? "Live" : "Paused"}</span>
      </div>
      <h3>${esc(account.brand)}</h3>
      <p class="handle">@${esc(account.handle)}</p>
      <dl class="metrics">
        <div><dt>Followers</dt><dd>${compact(account.followers)}</dd></div>
        <div><dt>Views · 7d</dt><dd>${compact(account.views7d)}</dd></div>
        <div><dt>Engagement</dt><dd>${account.engagement.toFixed(1)}%</dd></div>
        <div><dt>Growth</dt><dd>${signedPct(account.growth)}</dd></div>
      </dl>
      <div class="switch-row">
        <div>
          <strong>Autopilot</strong>
          <p class="fine">Weight variants by what has performed.</p>
        </div>
        <button type="button" class="switch ${account.autopilot ? "on" : ""}" role="switch" aria-checked="${account.autopilot ? "true" : "false"}" data-action="autopilot" data-id="${account.id}" aria-label="Autopilot for ${esc(account.brand)} on ${esc(PLATFORMS[account.platform].label)}"><span></span></button>
      </div>
      <div class="row-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="pause" data-id="${account.id}">${account.status === "live" ? "Pause" : "Resume"}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="remove-account" data-id="${account.id}">Remove</button>
      </div>
    </article>`).join("");

    return `<div class="toolbar">
      ${chipRow("account-filter", ui.accountFilter)}
      ${searchBox("Search accounts")}
      <span class="fine">${list.length} shown</span>
      <button type="button" class="btn btn-primary grow" data-action="connect-open">Connect account</button>
    </div>
    ${list.length ? `<div class="cards">${cards}</div>` : `<div class="card">${empty("No accounts match", "Try another platform or clear the search.")}</div>`}`;
  }

  function renderLibrary() {
    const q = ui.query.trim().toLowerCase();
    const list = state.clips.filter((clip) => {
      const account = accountById(clip.accountId);
      if (ui.libraryFilter !== "all" && (!account || account.platform !== ui.libraryFilter)) return false;
      if (!q) return true;
      const hay = `${clip.title} ${clip.brand} ${clip.hook} ${clip.grade} ${account ? PLATFORMS[account.platform].label : ""}`.toLowerCase();
      return hay.includes(q);
    });
    const cards = list.map((clip) => {
      const account = accountById(clip.accountId);
      return `<article class="clip-card" tabindex="0" data-action="open-clip" data-id="${clip.id}">
        ${thumb(clip)}
        <div class="clip-meta">
          <strong class="clamp">${esc(clip.title)}</strong>
          <span class="fine">${account ? `${PLATFORMS[account.platform].label} · ` : ""}${compact(clip.views)} views</span>
        </div>
      </article>`;
    }).join("");

    return `<div class="toolbar">
      ${chipRow("library-filter", ui.libraryFilter)}
      ${searchBox("Search clips")}
      <span class="fine">${list.length} clips</span>
      <button type="button" class="btn btn-primary grow" data-action="upload-open">Add clip</button>
    </div>
    ${list.length ? `<div class="library">${cards}</div>` : `<div class="card">${empty("Nothing in this view", "Add a clip, or widen the filter.")}</div>`}`;
  }

  function stepsHtml(step) {
    const labels = [
      "Reading post history",
      "Weighting the top quartile",
      "Composing hooks, grades, and overlays",
    ];
    return `<div class="steps">${labels.map((label, index) => {
      const cls = index < step ? "on" : index === step ? "on now" : "";
      return `<div class="step ${cls}"><span class="step-dot"></span><span>${label}</span></div>`;
    }).join("")}</div>`;
  }

  function renderVariants() {
    const clip = selectedClip();
    if (!clip) {
      return `<div class="card">${empty("Library is empty", "Add a clip before generating variants.")}</div>`;
    }
    const account = accountById(clip.accountId);
    const sources = state.clips.slice().sort((a, b) => b.views - a.views).map((item) => {
      const on = item.id === clip.id ? " on" : "";
      return `<button type="button" class="source${on}" data-action="select-clip" data-id="${item.id}" aria-pressed="${item.id === clip.id}">
        ${thumb(item)}
        <span class="clamp">${esc(item.title)}</span>
      </button>`;
    }).join("");
    const variants = state.variants
      .filter((variant) => variant.clipId === clip.id)
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    const cards = variants.map((variant) => `<article class="card variant">
      <div class="variant-top">
        <span class="fit">Fit ${variant.score}</span>
        ${variant.status === "queued" ? '<span class="status live"><i class="dot"></i>Queued</span>' : '<span class="fine">Draft</span>'}
      </div>
      <p class="quote quote-sm">${esc(variant.hook)}</p>
      <p class="muted">${esc(variant.grade)} · ${esc(variant.overlay)}</p>
      <p class="reach"><strong>${compact(variant.reach)}</strong> <span class="fine">modeled reach</span></p>
      <button type="button" class="btn ${variant.status === "queued" ? "btn-ghost" : "btn-primary"}" data-action="queue-variant" data-id="${variant.id}" ${variant.status === "queued" ? "disabled" : ""}>${variant.status === "queued" ? "In schedule" : "Add to schedule"}</button>
    </article>`).join("");
    const busy = ui.generating !== null;

    return `<div class="sources" aria-label="Source clips">${sources}</div>
      <div class="studio-head">
        <div class="statline">
          <div><small>Views</small><strong>${compact(clip.views)}</strong></div>
          <div><small>Saves</small><strong>${compact(clip.saves)}</strong></div>
          <div><small>Proven grade</small><strong>${esc(clip.grade)}</strong></div>
          <div><small>Account</small><strong>${account ? esc(PLATFORMS[account.platform].label) : "—"}</strong></div>
        </div>
        <button type="button" class="btn btn-accent" data-action="generate" ${busy ? "disabled" : ""}>${busy ? "Generating…" : "Generate variants"}</button>
      </div>
      <p class="hint muted">Fit rises when the hook and grade resemble posts already in the top quartile.</p>
      ${busy ? stepsHtml(ui.generating) : ""}
      ${variants.length ? `<div class="variant-grid">${cards}</div>` : `<div class="card">${empty("No variants yet", "Generate a set from this clip’s performance.")}</div>`}`;
  }

  function scheduleDefaults() {
    const soon = new Date(Date.now() + 26 * 3600 * 1000);
    const clip = clipById(ui.prefillClip) || state.clips[0] || null;
    const account = liveAccountFor(clip);
    return {
      clipId: clip ? clip.id : "",
      accountId: account ? account.id : "",
      date: dayKey(soon),
      time: "09:30",
      caption: clip ? clip.hook : "",
    };
  }

  function renderSchedule() {
    const draft = ui.draft || scheduleDefaults();
    const clipOptions = state.clips.map((clip) => `<option value="${clip.id}" ${clip.id === draft.clipId ? "selected" : ""}>${esc(clip.title)}</option>`).join("");
    const accountOptions = state.accounts.map((account) => {
      const disabled = account.status !== "live" ? "disabled" : "";
      const selected = account.id === draft.accountId ? "selected" : "";
      const note = account.status !== "live" ? " · paused" : "";
      return `<option value="${account.id}" ${selected} ${disabled}>${esc(account.brand)} · ${esc(PLATFORMS[account.platform].label)}${note}</option>`;
    }).join("");
    const today = dayKey(new Date());
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const date = startOfDay(new Date());
      date.setDate(date.getDate() + i);
      const key = dayKey(date);
      const count = state.queue.filter((item) => item.status === "scheduled" && dayKey(item.at) === key).length;
      const on = ui.scheduleDay === key ? " on" : "";
      const isToday = key === today ? " today" : "";
      days.push(`<button type="button" class="day${on}${isToday}" data-action="day" data-day="${key}">
        <small>${date.toLocaleDateString("en-US", { weekday: "short" })}</small>
        <b>${date.getDate()}</b>
        <small>${count ? `${count} queued` : "—"}</small>
      </button>`);
    }

    const scheduled = state.queue.filter((item) => item.status === "scheduled");
    let upcoming = scheduled;
    if (ui.scheduleDay) upcoming = upcoming.filter((item) => dayKey(item.at) === ui.scheduleDay);
    upcoming.sort((a, b) => new Date(a.at) - new Date(b.at));
    const posted = state.queue
      .filter((item) => item.status === "posted")
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8);

    const row = (item, upcomingRow) => {
      const clip = clipById(item.clipId);
      const variant = state.variants.find((entry) => entry.id === item.variantId);
      const account = accountById(item.accountId);
      const who = account ? `${PLATFORMS[account.platform].label} · @${account.handle}` : "Unassigned";
      const look = variant ? `${variant.grade} · ${variant.overlay}` : "Original cut";
      const actions = upcomingRow
        ? `<div class="row-actions">
            <button type="button" class="btn btn-primary btn-sm" data-action="post-now" data-id="${item.id}">Post now</button>
            <button type="button" class="btn btn-ghost btn-sm" data-action="unschedule" data-id="${item.id}">Remove</button>
          </div>`
        : `<span class="status live"><i class="dot"></i>Posted</span>`;
      return `<article class="q-row">
        <div class="q-time">${upcomingRow ? esc(formatWhen(item.at)) : esc(ago(item.at))}</div>
        <div>
          <strong>${esc(clip ? clip.title : "Scheduled post")}</strong>
          <p class="muted">${esc(item.caption)}</p>
          <p class="fine">${esc(who)} · ${esc(look)}</p>
        </div>
        ${actions}
      </article>`;
    };

    return `<div class="schedule-layout">
      <form class="card form" id="queue-form">
        <h2>Add to queue</h2>
        <p class="muted">Pick a clip, a live account, and a time.</p>
        <label class="field"><span>Clip</span><select class="input" id="q-clip" name="clip">${clipOptions}</select></label>
        <label class="field"><span>Account</span><select class="input" id="q-account" name="account">${accountOptions}</select></label>
        <label class="field"><span>Date</span><input class="input" id="q-date" name="date" type="date" min="${today}" value="${esc(draft.date)}" required></label>
        <label class="field"><span>Time</span><input class="input" id="q-time" name="time" type="time" value="${esc(draft.time)}" required></label>
        <label class="field"><span>Caption</span><textarea class="input" id="q-caption" name="caption">${esc(draft.caption)}</textarea></label>
        <button type="submit" class="btn btn-primary">Add to queue</button>
      </form>
      <div>
        <div class="section-label">
          <h2>Upcoming</h2>
          ${ui.scheduleDay
            ? `<button type="button" class="link" data-action="day" data-day="">Show all</button>`
            : `<span class="fine">${scheduled.length} scheduled</span>`}
        </div>
        <div class="days">${days.join("")}</div>
        <div class="q-list">
          ${upcoming.length ? upcoming.map((item) => row(item, true)).join("") : empty(ui.scheduleDay ? "Nothing queued this day" : "Nothing queued", "Add a post with the form, or send a variant here from the studio.")}
        </div>
        <div class="section-label"><h2>Recently posted</h2></div>
        <div class="q-list">
          ${posted.length ? posted.map((item) => row(item, false)).join("") : empty("No posts yet", "Mark a queued item posted to see it here.")}
        </div>
      </div>
    </div>`;
  }

  function renderAnalytics() {
    const n = ui.range === "7d" ? 7 : ui.range === "90d" ? 90 : 28;
    const ranges = [["7d", "7 days"], ["28d", "28 days"], ["90d", "90 days"]];
    const rangeChips = ranges.map(([id, label]) => `<button type="button" class="chip ${ui.range === id ? "on" : ""}" data-action="range" data-range="${id}">${label}</button>`).join("");
    const rollupMap = {};
    state.accounts.forEach((account) => {
      if (!rollupMap[account.platform]) rollupMap[account.platform] = { views: 0, accounts: 0 };
      rollupMap[account.platform].views += account.views7d;
      rollupMap[account.platform].accounts += 1;
    });
    const maxViews = Math.max(1, ...Object.values(rollupMap).map((row) => row.views));
    const bars = Object.keys(PLATFORMS).map((platform) => {
      const row = rollupMap[platform] || { views: 0, accounts: 0 };
      const width = Math.max(2, Math.round((row.views / maxViews) * 100));
      return `<div class="bar-row">
        <span>${esc(PLATFORMS[platform].label)}</span>
        <div class="bar"><span style="--w:${width}%"></span></div>
        <b>${compact(row.views)}</b>
      </div>`;
    }).join("");

    const rows = state.accounts.slice().sort((a, b) => {
      const dir = ui.sortDir === "asc" ? 1 : -1;
      const av = a[ui.sortKey];
      const bv = b[ui.sortKey];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    const mark = (key) => (ui.sortKey === key ? (ui.sortDir === "asc" ? " ↑" : " ↓") : "");
    const head = (key, label) => `<th><button type="button" data-action="sort" data-sort="${key}">${label}${mark(key)}</button></th>`;
    const body = rows.map((account) => `<tr>
      <td><div class="who">${chip(account.platform)}<span><strong>${esc(account.brand)}</strong><span class="fine" style="display:block">@${esc(account.handle)}</span></span></div></td>
      <td>${esc(PLATFORMS[account.platform].label)}</td>
      <td>${compact(account.followers)}</td>
      <td>${compact(account.views7d)}</td>
      <td>${account.engagement.toFixed(1)}%</td>
      <td>${signedPct(account.growth)}</td>
    </tr>`).join("");

    const hooks = state.clips.slice().sort((a, b) => b.views - a.views).slice(0, 6);
    const hookRows = hooks.map((clip) => {
      const account = accountById(clip.accountId);
      return `<tr>
        <td>${esc(clip.hook)}</td>
        <td>${esc(clip.grade)}</td>
        <td>${esc(clip.title)}</td>
        <td>${account ? esc(account.brand) : "—"}</td>
        <td>${compact(clip.views)}</td>
        <td>${compact(clip.saves)}</td>
      </tr>`;
    }).join("");

    return `<div class="toolbar"><div class="chips">${rangeChips}</div></div>
      <div class="stack">
        <article class="card rise" style="--d:0">${chartBlock(n, `Views · last ${n} days`)}</article>
        <section class="platform-grid rise" style="--d:1">
          <article class="card">
            <h2>By platform</h2>
            <p class="muted" style="margin:4px 0 14px">Views over the last 7 days.</p>
            <div class="bars">${bars}</div>
          </article>
          <article class="card">
            <h2>Blended</h2>
            <dl class="metrics" style="margin-top:14px">
              <div><dt>Avg. CPM</dt><dd>$0.17</dd></div>
              <div><dt>Engagement</dt><dd>${weightedEngagement().toFixed(1)}%</dd></div>
              <div><dt>Live accounts</dt><dd>${state.accounts.filter((account) => account.status === "live").length}</dd></div>
              <div><dt>Autopilot</dt><dd>${state.accounts.filter((account) => account.autopilot).length}</dd></div>
            </dl>
          </article>
        </section>
        <article class="card rise" style="--d:2">
          <h2>Accounts</h2>
          <div class="table-wrap" style="margin-top:12px">
            <table class="table">
              <thead><tr>
                ${head("brand", "Account")}${head("platform", "Platform")}${head("followers", "Followers")}${head("views7d", "Views")}${head("engagement", "Engagement")}${head("growth", "Growth")}
              </tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </article>
        <article class="card rise" style="--d:3">
          <h2>Hooks earning views</h2>
          <div class="table-wrap" style="margin-top:12px">
            <table class="table">
              <thead><tr><th>Hook</th><th>Grade</th><th>Clip</th><th>Brand</th><th>Views</th><th>Saves</th></tr></thead>
              <tbody>${hookRows}</tbody>
            </table>
          </div>
        </article>
      </div>`;
  }

  function renderView() {
    if (ui.view === "accounts") return renderAccounts();
    if (ui.view === "library") return renderLibrary();
    if (ui.view === "variants") return renderVariants();
    if (ui.view === "schedule") return renderSchedule();
    if (ui.view === "analytics") return renderAnalytics();
    return renderOverview();
  }

  function animateNumbers(root) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const kind = el.dataset.kind || "int";
      if (reduce || Number.isNaN(target)) {
        el.textContent = formatKind(kind, target);
        return;
      }
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / 800);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = formatKind(kind, target * eased);
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = formatKind(kind, target);
      }
      requestAnimationFrame(frame);
    });
  }

  function updateChrome() {
    const [title, sub] = COPY[ui.view] || COPY.overview;
    document.getElementById("page-title").textContent = title;
    document.getElementById("page-sub").textContent = sub;
    document.title = `${title} · Relay`;
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const on = button.dataset.nav === ui.view;
      button.classList.toggle("active", on);
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const meta = document.getElementById("side-meta");
    if (meta) meta.textContent = `${state.accounts.length} accounts · ${queuedCount()} queued`;
  }

  function snapshotDraft() {
    const clip = document.getElementById("q-clip");
    if (!clip) return;
    ui.draft = {
      clipId: clip.value,
      accountId: document.getElementById("q-account").value,
      date: document.getElementById("q-date").value,
      time: document.getElementById("q-time").value,
      caption: document.getElementById("q-caption").value,
    };
  }

  function paint(options = {}) {
    const animate = Boolean(options.animate);
    const snapshot = options.snapshot !== false;
    const active = document.activeElement;
    const focusId = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") ? active.id : "";
    const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    if (snapshot) snapshotDraft();
    const root = document.getElementById("view");
    root.innerHTML = `<div class="view-inner${animate ? " play" : ""}">${renderView()}</div>`;
    if (animate) animateNumbers(root);
    updateChrome();
    if (focusId) {
      const next = document.getElementById(focusId);
      if (next) {
        next.focus();
        if (caret != null && next.setSelectionRange) {
          try { next.setSelectionRange(caret, caret); } catch (err) { /* date inputs */ }
        }
      }
    }
  }

  function setHash(view) {
    const next = `#/${view}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }

  function hashView() {
    const view = location.hash.replace(/^#\/?/, "");
    return COPY[view] ? view : null;
  }

  function show(view, options = {}) {
    if (!COPY[view]) view = "overview";
    if (view !== ui.view) ui.query = "";
    ui.view = view;
    if (options.hash !== false) setHash(view);
    paint({ animate: options.animate !== false, snapshot: options.snapshot !== false });
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.innerHTML = `<div class="toast">${esc(message)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.innerHTML = ""; }, 2800);
  }

  function closeModal() {
    document.getElementById("modal-root").innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function openModal(html, wide) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-layer">
      <button type="button" class="modal-back" data-action="modal-close" aria-label="Close dialog"></button>
      <div class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" tabindex="-1">
        <button type="button" class="close-x" data-action="modal-close" aria-label="Close">${icon("x")}</button>
        ${html}
      </div>
    </div>`;
    document.body.classList.add("modal-open");
    const dialog = root.querySelector(".modal");
    const field = root.querySelector("input, select, textarea");
    (field || dialog).focus();
  }

  function paintLogin() {
    const views = views7d();
    const accounts = state.accounts.length;
    const platforms = new Set(state.accounts.map((account) => account.platform)).size;
    const set = (id, value, kind) => {
      const el = document.getElementById(id);
      el.dataset.count = String(value);
      el.dataset.kind = kind;
      el.textContent = formatKind(kind, value);
    };
    set("login-views", views, "compact");
    set("login-accounts", accounts, "int");
    set("login-platforms", platforms, "int");
    if (!document.body.classList.contains("in-app")) animateNumbers(document.getElementById("login"));
  }

  function login() {
    const button = document.getElementById("login-btn");
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Opening workspace…";
    const view = hashView() || "overview";
    document.body.classList.add("booting");
    show(view, { animate: false });
    requestAnimationFrame(() => document.body.classList.add("leaving"));
    setTimeout(() => {
      document.body.classList.add("in-app");
      document.body.classList.remove("booting", "leaving");
      sessionStorage.setItem("relay-session", "1");
      paint({ animate: true, snapshot: false });
      button.disabled = false;
      button.textContent = "Enter workspace";
    }, 520);
  }

  function logout() {
    clearInterval(ui.genTimer);
    ui.generating = null;
    sessionStorage.removeItem("relay-session");
    document.documentElement.classList.remove("has-session");
    document.body.classList.remove("in-app", "booting", "leaving", "modal-open");
    history.replaceState(null, "", location.pathname + location.search);
    closeModal();
    paintLogin();
    document.title = "Relay — Content operations";
  }

  function resetDemo() {
    clearInterval(ui.genTimer);
    ui.generating = null;
    ui.selectedClip = null;
    ui.prefillClip = null;
    ui.draft = null;
    ui.query = "";
    ui.scheduleDay = "";
    localStorage.removeItem(STORAGE_KEY);
    state = createSeed();
    closeModal();
    paint({ animate: true, snapshot: false });
    paintLogin();
    toast("Sample data restored.");
  }

  function openConnect() {
    const options = Object.entries(PLATFORMS).map(([id, meta]) => `<option value="${id}">${esc(meta.label)}</option>`).join("");
    openModal(`<h2>Connect an account</h2>
      <p class="modal-copy">Saved in this sample workspace.</p>
      <form class="form" id="connect-form" autocomplete="off">
        <label class="field"><span>Brand</span><input class="input" name="brand" placeholder="Northwind" required></label>
        <label class="field"><span>Platform</span><select class="input" name="platform">${options}</select></label>
        <label class="field"><span>Handle</span><input class="input" name="handle" placeholder="northwind" required></label>
        <button type="submit" class="btn btn-primary btn-block">Connect</button>
      </form>`);
  }

  function saveAccount(form) {
    const data = new FormData(form);
    const brand = String(data.get("brand") || "").trim();
    const handle = String(data.get("handle") || "").trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
    const platform = String(data.get("platform") || "");
    if (!brand || !handle || !PLATFORMS[platform]) {
      toast("Add a brand, platform, and handle.");
      return;
    }
    if (state.accounts.some((account) => account.platform === platform && account.handle === handle)) {
      toast("That account is already connected.");
      return;
    }
    state.accounts.unshift({
      id: uid("a"),
      brand,
      platform,
      handle,
      followers: 0,
      views7d: 0,
      engagement: 0,
      status: "live",
      autopilot: false,
      postsWeek: 0,
      growth: 0,
    });
    save();
    closeModal();
    toast("Account connected.");
    paint();
  }

  function openUpload() {
    const options = state.accounts.map((account) => `<option value="${account.id}">${esc(account.brand)} · ${esc(PLATFORMS[account.platform].label)}</option>`).join("");
    if (!options) {
      toast("Connect an account first.");
      return;
    }
    openModal(`<h2>Add a clip</h2>
      <p class="modal-copy">A source the studio can repurpose.</p>
      <form class="form" id="upload-form" autocomplete="off">
        <label class="field"><span>Title</span><input class="input" name="title" placeholder="Morning light, 15 seconds" required></label>
        <label class="field"><span>Account</span><select class="input" name="account">${options}</select></label>
        <label class="field"><span>Duration</span><input class="input" name="duration" placeholder="0:15" value="0:15"></label>
        <button type="submit" class="btn btn-primary btn-block">Add to library</button>
      </form>`);
  }

  function saveClip(form) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const account = accountById(String(data.get("account") || ""));
    const duration = String(data.get("duration") || "").trim() || "0:15";
    if (!title || !account) {
      toast("Add a title and an account.");
      return;
    }
    const hues = [18, 28, 42, 80, 152, 200, 210, 262, 330];
    state.clips.unshift({
      id: uid("c"),
      title,
      brand: account.brand,
      accountId: account.id,
      duration,
      views: 0,
      saves: 0,
      shares: 0,
      hook: "New cut.",
      grade: "Neutral",
      hue: hues[state.clips.length % hues.length],
      postedAt: new Date().toISOString(),
    });
    save();
    closeModal();
    toast("Clip added to the library.");
    paint();
  }

  function openClip(id) {
    const clip = clipById(id);
    if (!clip) return;
    const account = accountById(clip.accountId);
    const saveRate = clip.views ? ((clip.saves / clip.views) * 100).toFixed(1) : "—";
    openModal(`<div class="clip-modal">
      ${thumb(clip)}
      <div>
        <div class="account-top">${account ? chip(account.platform) : ""}<span class="fine">${esc(ago(clip.postedAt))}</span></div>
        <h2 style="margin-top:8px">${esc(clip.title)}</h2>
        <p class="fine" style="margin-top:4px">${esc(clip.brand)}${account ? ` · @${esc(account.handle)}` : ""}</p>
        <p class="quote" style="margin:12px 0">${esc(clip.hook)}</p>
        <dl class="metrics">
          <div><dt>Views</dt><dd>${compact(clip.views)}</dd></div>
          <div><dt>Saves</dt><dd>${compact(clip.saves)}</dd></div>
          <div><dt>Shares</dt><dd>${compact(clip.shares)}</dd></div>
          <div><dt>Save rate</dt><dd>${saveRate}${saveRate === "—" ? "" : "%"}</dd></div>
        </dl>
        <div class="row-actions" style="margin-top:8px">
          <button type="button" class="btn btn-primary" data-action="use-clip" data-id="${clip.id}">Create variants</button>
          <button type="button" class="btn btn-ghost" data-action="schedule-clip" data-id="${clip.id}">Schedule</button>
        </div>
      </div>
    </div>`, true);
  }

  function hashCode(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
    return h;
  }

  function scoreVariant(clip, combo) {
    const account = accountById(clip.accountId);
    let score = 64;
    if (clip.views >= 1000000) score += 10;
    else if (clip.views >= 300000) score += 5;
    if (combo.grade === clip.grade) score += 9;
    if (combo.hook === clip.hook) score += 6;
    const saveRate = clip.views ? clip.saves / clip.views : 0;
    score += Math.min(8, saveRate * 500);
    if (account && account.autopilot) score += 3;
    score += (Math.abs(hashCode(combo.hook + combo.grade + combo.overlay + clip.id)) % 7) - 3;
    return Math.max(50, Math.min(97, Math.round(score)));
  }

  function commitVariants(clipId) {
    const clip = clipById(clipId);
    if (!clip) return 0;
    const hooks = Array.from(new Set(HOOKS.concat(clip.hook ? [clip.hook] : [])));
    const existing = new Set(
      state.variants.filter((variant) => variant.clipId === clipId).map((variant) => `${variant.hook}|${variant.grade}|${variant.overlay}`)
    );
    const combos = [];
    hooks.forEach((hook) => {
      GRADES.forEach((grade) => {
        OVERLAYS.forEach((overlay) => {
          const key = `${hook}|${grade}|${overlay}`;
          if (!existing.has(key)) combos.push({ hook, grade, overlay, key });
        });
      });
    });
    combos.forEach((combo) => { combo.score = scoreVariant(clip, combo); });
    combos.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const pick = combos.slice(0, 4);
    if (!pick.length) {
      toast("Every combination for this clip is already in the studio.");
      return 0;
    }
    const account = accountById(clip.accountId);
    const base = clip.views > 0 ? clip.views : ((account && account.views7d) || 100000) * 0.08;
    const now = Date.now();
    pick.forEach((combo, index) => {
      state.variants.unshift({
        id: uid("v"),
        clipId,
        hook: combo.hook,
        grade: combo.grade,
        overlay: combo.overlay,
        score: combo.score,
        reach: Math.round(base * (combo.score / 100) * 0.34),
        status: "draft",
        created: new Date(now - index).toISOString(),
      });
    });
    save();
    toast(pick.length === 1 ? "1 variant added." : `${pick.length} variants added.`);
    return pick.length;
  }

  function startGenerate() {
    if (ui.generating !== null) return;
    const clip = selectedClip();
    if (!clip) return;
    ui.generating = 0;
    const clipId = clip.id;
    paint();
    clearInterval(ui.genTimer);
    ui.genTimer = setInterval(() => {
      ui.generating += 1;
      if (ui.generating >= 3) {
        clearInterval(ui.genTimer);
        ui.generating = null;
        commitVariants(clipId);
        if (ui.view === "variants") paint({ animate: true });
        return;
      }
      if (ui.view === "variants") paint();
    }, 520);
  }

  function nextSlot() {
    const date = new Date(Date.now() + 3 * 3600 * 1000);
    const minutes = date.getMinutes();
    if (minutes < 30) date.setMinutes(30, 0, 0);
    else {
      date.setHours(date.getHours() + 1);
      date.setMinutes(0, 0, 0);
    }
    return date;
  }

  function queueVariant(id) {
    const variant = state.variants.find((item) => item.id === id);
    if (!variant || variant.status === "queued") return;
    const clip = clipById(variant.clipId);
    const account = liveAccountFor(clip);
    if (!account) {
      toast("Unpause an account before scheduling.");
      return;
    }
    const when = nextSlot();
    state.queue.push({
      id: uid("q"),
      clipId: clip.id,
      accountId: account.id,
      variantId: variant.id,
      at: when.toISOString(),
      status: "scheduled",
      caption: variant.hook,
    });
    variant.status = "queued";
    save();
    toast(`Added for ${formatWhen(when.toISOString())}.`);
    paint();
  }

  function addQueue() {
    const clip = clipById(document.getElementById("q-clip").value);
    const account = accountById(document.getElementById("q-account").value);
    const date = document.getElementById("q-date").value;
    const time = document.getElementById("q-time").value;
    const caption = document.getElementById("q-caption").value.trim();
    if (!clip || !account) {
      toast("Choose a clip and an account.");
      return;
    }
    if (account.status !== "live") {
      toast("That account is paused.");
      return;
    }
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const when = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (Number.isNaN(when.getTime())) {
      toast("That time is not valid.");
      return;
    }
    if (when.getTime() < Date.now() - 60000) {
      toast("Choose a time in the future.");
      return;
    }
    state.queue.push({
      id: uid("q"),
      clipId: clip.id,
      accountId: account.id,
      variantId: null,
      at: when.toISOString(),
      status: "scheduled",
      caption: caption || clip.hook,
    });
    save();
    ui.draft = null;
    ui.prefillClip = clip.id;
    const horizon = startOfDay(new Date());
    horizon.setDate(horizon.getDate() + 6);
    ui.scheduleDay = date <= dayKey(horizon) ? date : "";
    toast(`Scheduled for ${formatWhen(when.toISOString())}.`);
    paint({ snapshot: false });
  }

  function postNow(id) {
    const item = state.queue.find((entry) => entry.id === id);
    if (!item || item.status !== "scheduled") return;
    const account = accountById(item.accountId);
    if (account && account.status !== "live") {
      toast("Unpause the account before posting.");
      return;
    }
    item.status = "posted";
    item.at = new Date().toISOString();
    save();
    const name = account ? `${PLATFORMS[account.platform].label} · ${account.handle}` : "the account";
    toast(`Posted in the sample workspace · ${name}.`);
    paint();
  }

  function unschedule(id) {
    const item = state.queue.find((entry) => entry.id === id);
    if (!item || item.status !== "scheduled") return;
    state.queue = state.queue.filter((entry) => entry.id !== id);
    if (item.variantId && !state.queue.some((entry) => entry.variantId === item.variantId && entry.status === "scheduled")) {
      const variant = state.variants.find((entry) => entry.id === item.variantId);
      if (variant) variant.status = "draft";
    }
    save();
    toast("Removed from the schedule.");
    paint();
  }

  function removeAccount(id) {
    const removed = state.queue.filter((item) => item.accountId === id && item.variantId && item.status === "scheduled").map((item) => item.variantId);
    state.queue = state.queue.filter((item) => item.accountId !== id);
    removed.forEach((variantId) => {
      if (!state.queue.some((item) => item.variantId === variantId && item.status === "scheduled")) {
        const variant = state.variants.find((entry) => entry.id === variantId);
        if (variant) variant.status = "draft";
      }
    });
    state.accounts = state.accounts.filter((account) => account.id !== id);
    save();
  }

  function onClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "login") login();
    else if (action === "logout") logout();
    else if (action === "reset") resetDemo();
    else if (action === "nav") show(target.dataset.nav);
    else if (action === "modal-close") closeModal();
    else if (action === "connect-open") openConnect();
    else if (action === "upload-open") openUpload();
    else if (action === "open-clip") openClip(target.dataset.id);
    else if (action === "use-clip") {
      ui.selectedClip = target.dataset.id;
      closeModal();
      show("variants");
    } else if (action === "schedule-clip") {
      ui.prefillClip = target.dataset.id;
      ui.draft = null;
      closeModal();
      show("schedule");
    } else if (action === "account-filter") {
      ui.accountFilter = target.dataset.filter;
      paint();
    } else if (action === "library-filter") {
      ui.libraryFilter = target.dataset.filter;
      paint();
    } else if (action === "autopilot") {
      const account = accountById(target.dataset.id);
      if (!account) return;
      account.autopilot = !account.autopilot;
      save();
      toast(account.autopilot ? `Autopilot on for ${account.brand}.` : `Autopilot off for ${account.brand}.`);
      paint();
    } else if (action === "pause") {
      const account = accountById(target.dataset.id);
      if (!account) return;
      account.status = account.status === "live" ? "paused" : "live";
      save();
      toast(account.status === "live" ? `${account.brand} is live.` : `${account.brand} is paused.`);
      paint();
    } else if (action === "remove-account") {
      const account = accountById(target.dataset.id);
      if (!account) return;
      openModal(`<h2>Remove ${esc(account.brand)}?</h2>
        <p class="modal-copy">${esc(PLATFORMS[account.platform].label)} · @${esc(account.handle)}. Scheduled posts for this account will be cancelled.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="modal-close">Keep</button>
          <button type="button" class="btn btn-danger" data-action="remove-account-confirm" data-id="${account.id}">Remove account</button>
        </div>`);
    } else if (action === "remove-account-confirm") {
      const account = accountById(target.dataset.id);
      removeAccount(target.dataset.id);
      closeModal();
      toast(account ? `${account.brand} removed.` : "Account removed.");
      paint();
    } else if (action === "select-clip") {
      if (ui.generating !== null) return;
      ui.selectedClip = target.dataset.id;
      paint();
    } else if (action === "generate") startGenerate();
    else if (action === "queue-variant") queueVariant(target.dataset.id);
    else if (action === "day") {
      const day = target.dataset.day || "";
      ui.scheduleDay = !day || ui.scheduleDay === day ? "" : day;
      paint();
    } else if (action === "post-now") postNow(target.dataset.id);
    else if (action === "unschedule") unschedule(target.dataset.id);
    else if (action === "range") {
      ui.range = target.dataset.range;
      paint();
    } else if (action === "sort") {
      const key = target.dataset.sort;
      if (ui.sortKey === key) ui.sortDir = ui.sortDir === "asc" ? "desc" : "asc";
      else {
        ui.sortKey = key;
        ui.sortDir = key === "brand" || key === "platform" ? "asc" : "desc";
      }
      paint();
    } else if (action === "jump-platform") {
      ui.accountFilter = target.dataset.platform || "all";
      ui.query = "";
      show("accounts");
    }
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("submit", (event) => {
      if (event.target.id === "queue-form") {
        event.preventDefault();
        addQueue();
      } else if (event.target.id === "connect-form") {
        event.preventDefault();
        saveAccount(event.target);
      } else if (event.target.id === "upload-form") {
        event.preventDefault();
        saveClip(event.target);
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "search") {
        ui.query = event.target.value;
        paint();
      }
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "q-clip") {
        const clip = clipById(event.target.value);
        const caption = document.getElementById("q-caption");
        if (clip && caption) caption.value = clip.hook;
        ui.prefillClip = event.target.value;
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
      const typing = event.target && (event.target.closest("input, textarea, select"));
      if (event.key === "Enter" && !document.body.classList.contains("in-app") && !typing) {
        event.preventDefault();
        const button = document.getElementById("login-btn");
        if (button && !button.disabled) button.click();
      }
      if (event.key === "/" && !typing && document.body.classList.contains("in-app")) {
        const search = document.getElementById("search");
        if (search) {
          event.preventDefault();
          search.focus();
        }
      }
      if ((event.key === "Enter" || event.key === " ") && event.target && event.target.dataset && event.target.dataset.action === "open-clip" && event.target.tagName !== "BUTTON") {
        event.preventDefault();
        openClip(event.target.dataset.id);
      }
    });
    window.addEventListener("hashchange", () => {
      if (!document.body.classList.contains("in-app") && !document.documentElement.classList.contains("has-session")) return;
      const view = hashView();
      if (view && view !== ui.view) show(view);
    });
  }

  function tickClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    el.dateTime = new Date().toISOString();
  }

  function init() {
    const authed = sessionStorage.getItem("relay-session") === "1";
    if (authed) document.body.classList.add("in-app");
    paintLogin();
    bind();
    tickClock();
    setInterval(tickClock, 30000);
    if (authed) show(hashView() || "overview");
  }

  init();
})();
