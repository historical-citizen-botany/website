/* Flora Batava observer networks: interactive figures for the Results section. Needs js/results-data.js. */
(function () {
const DATA = window.FB_DATA;

const NS = "http://www.w3.org/2000/svg";
const byId = new Map(DATA.nodes.map(n => [n.id, n]));
const adj = new Map(DATA.nodes.map(n => [n.id, []]));
DATA.edges.forEach(e => { adj.get(e.a).push([e.b, e.w]); adj.get(e.b).push([e.a, e.w]); });
const commSize = {};
DATA.nodes.forEach(n => { commSize[n.community] = (commSize[n.community] || 0) + 1; });
const CATEGORY_LABEL = { author: "author", female: "woman", male: "man", group: "group", unknown: "unknown" };
const state = { view: "observer", picked: null, province: null, division: null };

const radius = n => 3 + 1.6 * Math.sqrt(Math.sqrt(n.records));
const colours = n => state.view === "observer" ? n.obs : n.tax;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const swatch = ([fill, line]) => `<i style="background:${fill};border-color:${line}"></i>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* ---------- hover tooltip ---------- */
const tip = document.getElementById("fb-tip");
function hoverable(target, text) {
  target.addEventListener("pointerenter", ev => { if (ev.pointerType === "touch") return; tip.innerHTML = text(); tip.hidden = false; });
  target.addEventListener("pointermove", ev => { tip.style.left = ev.clientX + "px"; tip.style.top = ev.clientY + "px"; });
  target.addEventListener("pointerleave", () => { tip.hidden = true; });
}

/* ---------- 1. network ---------- */
const svg = document.getElementById("net");
const [W, H] = DATA.size;
svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
const gEdges = el("g", {}, svg), gNodes = el("g", {}, svg), gLabels = el("g", {}, svg);
const s1 = DATA.nodes.filter(n => n.x !== null);
const edgeEls = [];
DATA.edges.forEach(e => {
  const a = byId.get(e.a), b = byId.get(e.b);
  if (a.x === null) return;
  const line = el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge", "stroke-width": Math.min(0.8 + e.w * 0.25, 7) }, gEdges);
  edgeEls.push({ line, a, b });
});
const nodeEls = new Map();
function addNode(parent, n, x, y) {
  const g = el("g", { class: "node", tabindex: 0, role: "button", "aria-label": n.name }, parent);
  const r = radius(n);
  const body = el("circle", { class: "body", cx: x, cy: y, r, "stroke-width": 1.5 }, g);
  const ring = el("circle", { class: "ring", cx: x, cy: y, r: r + 3.2 }, g);
  g.addEventListener("click", ev => { ev.stopPropagation(); pick(n.id); });
  g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(n.id); } });
  hoverable(g, () => esc(n.name));
  return { g, body, ring };
}
[...s1].sort((p, q) => q.records - p.records).forEach(n => nodeEls.set(n.id, addNode(gNodes, n, n.x, n.y)));
svg.addEventListener("click", () => pick(null));

function paintNode({ body, ring }, n) {
  const [fill, line] = colours(n);
  body.setAttribute("fill", fill); body.setAttribute("stroke", line);
  ring.style.display = state.view === "taxonomy" && n.category === "female" ? "" : "none";
}

function labels() {
  gLabels.replaceChildren();
  const names = new Set(DATA.top);
  if (state.picked && byId.get(state.picked).x !== null) names.add(state.picked);
  const placed = [];
  const scale = svg.getBoundingClientRect().width / W || 1;   // keep names ~13px on screen
  const size = Math.min(13 / scale, 30);
  [...names].map(id => byId.get(id)).sort((p, q) => q.y - p.y).forEach(n => {
    const r = radius(n);
    const t = el("text", { class: "label" + (n.id === state.picked ? " picked" : ""), x: n.x, y: n.y - r - 5,
      "text-anchor": "middle", "font-size": size, "stroke-width": size * 0.3 }, gLabels);
    t.textContent = n.name;
    let box = t.getBBox(), moved = false;
    for (let i = 0; i < 40 && placed.some(b => overlap(b, box)); i++) {
      t.setAttribute("y", +t.getAttribute("y") - box.height * 0.6); box = t.getBBox(); moved = true;
    }
    if (box.x < 4) t.setAttribute("x", n.x + (4 - box.x));
    if (box.x + box.width > W - 4) t.setAttribute("x", n.x - (box.x + box.width - W + 4));
    if (moved) el("line", { class: "leader", x1: n.x, y1: n.y - r, x2: n.x, y2: +t.getAttribute("y") + 2 }, gLabels);
    placed.push(t.getBBox());
  });
}
const overlap = (a, b) => !(b.x > a.x + a.width + 2 || b.x + b.width < a.x - 2 || b.y > a.y + a.height || b.y + b.height < a.y);

function highlight() {
  const n = state.picked && byId.get(state.picked);
  const comm = n ? n.community : null;
  nodeEls.forEach(({ g }, id) => {
    g.classList.toggle("dim", comm !== null && byId.get(id).community !== comm);
    g.classList.toggle("picked", id === state.picked);
  });
  edgeEls.forEach(({ line, a, b }) => line.classList.toggle("dim", comm !== null && !(a.community === comm && b.community === comm)));
  document.querySelectorAll(".pair").forEach(card => {
    const ids = card.dataset.ids.split("|");
    card.classList.toggle("dim", !!n && !ids.some(i => byId.get(i).community === comm));
  });
}

function caption() {
  const common = `Circle size grows with the person's total number of Flora Batava records; lines join names on the
    same record and get thicker with more shared records. Names shown: top-5 most connected people as measured
    by degree centrality (Dozy ties with Van der Sande Lacoste and Abeleven, but is left out as he has fewer
    records); hover over a circle for any other name.`;
  const cap = document.getElementById("cap");
  if (state.view === "observer") {
    const order = ["author", "female", "male", "group", "unknown"];
    cap.innerHTML = `<p><strong>Figure 1a. Observer view.</strong> Colour shows who each name was: the authors of
      the Flora Batava (all men), women, men, groups such as societies and excursions, and names whose sex is
      unknown. ${common}</p>
      <div class="legend">${order.map(k => `<span>${swatch(DATA.categories[k])}${CATEGORY_LABEL[k]}</span>`).join("")}</div>`;
  } else {
    const present = new Set(DATA.nodes.map(n => n.division));
    cap.innerHTML = `<p><strong>Figure 1b. Taxonomy view.</strong> Colour shows each name's main botanical division:
      the division with most of their records. A dark ring marks the women, nearly all of whom
      recorded mainly fungi. ${common}</p>
      <div class="legend">${Object.entries(DATA.divisions).filter(([k]) => present.has(k))
        .map(([k, c]) => `<span>${swatch(c)}${k}</span>`).join("")}<span><i class="ring"></i>woman</span></div>`;
  }
  document.getElementById("pair-cap").textContent = `Figure 2${state.view === "observer" ? "a" : "b"}. Pairs coloured as in
    Figure 1${state.view === "observer" ? "a" : "b"}; line thickness and the count give the records the two shared.`;
}

function personPanel() {
  const box = document.getElementById("person");
  const n = state.picked && byId.get(state.picked);
  document.getElementById("clear").hidden = !n;
  if (!n) {
    box.innerHTML = `<p class="empty">Click a circle to see who it is, their records and co-observers. Their community
      stays highlighted; the rest of the network fades.</p>`;
    return;
  }
  const partners = adj.get(n.id).slice().sort((p, q) => q[1] - p[1]);
  const where = n.x !== null ? `community ${n.community} · ${commSize[n.community]} names` : `pair outside the main network`;
  const link = (label, url) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label);
  const fams = n.families || [];
  box.innerHTML = `
    <span class="eyebrow">Selected</span>
    <h3>${link(n.name, n.link)}</h3>
    ${n.link ? `<p class="hint">The name opens a biography in a new tab.</p>` : ""}
    <div class="chips">
      <span class="chip">${swatch(n.obs)}${CATEGORY_LABEL[n.category]}</span>
      ${n.division ? (n["division.link"]
        ? `<a class="chip" href="${esc(n["division.link"])}" target="_blank" rel="noopener">${swatch(n.tax)}${esc(n.division)}</a>`
        : `<span class="chip">${swatch(n.tax)}${esc(n.division)}</span>`) : ""}
    </div>
    <div>
      <span class="eyebrow">${fams.length > 1 ? "Most observed families (tied)" : "Most observed family"}</span>
      <ul class="families">${fams.map(([f, u]) => `<li>${link(f, u)}</li>`).join("") || "<li>–</li>"}</ul>
    </div>
    <dl>
      <dt>Total records</dt><dd>${n.records}</dd>
      <dt>With an add. observer</dt><dd>${n["network.records"]}</dd>
      <dt>Co-observers</dt><dd>${n.degree}</dd>
      <dt>Degree centrality</dt><dd>${n.centrality.toFixed(3)}</dd>
      <dt>Group</dt><dd>${where}</dd>
    </dl>
    <div>
      <span class="eyebrow">Recorded with · shared records</span>
      <ul class="partners">${partners.map(([p, w]) => `<li><span>${esc(byId.get(p).name)}</span><b>${w}</b></li>`).join("")}</ul>
    </div>`;
}

/* ---------- 2. pairs ---------- */
const kb = link => `href="${esc(link)}" target="_blank" rel="noopener"`;
function recordsLink(n, records, noun) {
  const label = plural(n, noun);
  if (records.length === 1) return `<a ${kb(records[0].link)} title="${esc(records[0].species)}">${label}</a>`;
  return `<details class="recs"><summary>${label}</summary><ul>${records.map(r =>
    `<li><a ${kb(r.link)}>${esc(r.species)}</a></li>`).join("")}</ul></details>`;
}
const sharedLink = p => recordsLink(p.w, p.records, "shared record");
/* one species menu open at a time; close on a click elsewhere or Escape */
document.addEventListener("click", ev => {
  document.querySelectorAll(".recs[open]").forEach(d => { if (!d.contains(ev.target)) d.open = false; });
});
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") document.querySelectorAll(".recs[open]").forEach(d => { d.open = false; d.querySelector("summary").focus(); });
});
function pairCards() {
  const grid = document.getElementById("pair-grid");
  grid.replaceChildren();
  DATA.pairs.forEach(p => {
    const a = byId.get(p.a), b = byId.get(p.b);
    const card = document.createElement("article");
    card.className = "pair";
    card.dataset.ids = `${p.a}|${p.b}`;
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 260 56");
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", `${a.name} and ${b.name}, ${p.w} shared records`);
    el("line", { x1: 50, y1: 28, x2: 210, y2: 28, class: "edge", "stroke-width": Math.min(0.8 + p.w * 0.25, 10) }, s);
    [[a, 50], [b, 210]].forEach(([n, x]) => paintNode(addNode(s, n, x, 28), n));
    const dist = p.km === null ? "" : p.km === 0 ? " · same home place" : ` · homes ${p.km} km apart`;
    card.innerHTML = `<div class="names"><span>${esc(a.name)}</span><span>${esc(b.name)}</span></div>
      <div class="tags">${p.tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>
      <p class="note">${esc(p.note)}</p>
      <div class="meta">${sharedLink(p)}<span>${dist.replace(/^ · /, "· ")}</span></div>`;
    card.prepend(s);
    grid.appendChild(card);
  });
}

/* ---------- 2b. solo observers ---------- */
function soloCards() {
  const grid = document.getElementById("solo-grid");
  grid.innerHTML = DATA.solo.map(g => `<article class="solo-card">
    <h3>${esc(g.title)}</h3>
    <ul class="people">${g.people.map(p => {
      const name = p.link ? `<a ${kb(p.link)}>${esc(p.name)}</a>` : esc(p.name);
      const years = !p.years ? "" : p.years[0] === p.years[1] ? `· ${p.years[0]}` : `· records from ${p.years[0]}–${p.years[1]}`;
      return `<li><div class="who">${name}</div><div class="meta">${recordsLink(p.n, p.records, "record")}<span>${years}</span></div></li>`;
    }).join("")}</ul></article>`).join("");
}

/* ---------- 3. map ---------- */
const M = DATA.map;
const nl = document.getElementById("nl");
nl.setAttribute("viewBox", `0 0 ${M.width} ${M.height}`);
const gProv = el("g", {}, nl), gDots = el("g", { class: "dots" }, nl);
const provEls = new Map();
M.provinces.forEach(p => {
  const path = el("path", { d: p.path, class: "prov", tabindex: 0, role: "button", "aria-label": p.name, "fill-rule": "evenodd" }, gProv);
  path.addEventListener("click", ev => { ev.stopPropagation(); pickProvince(p.name); });
  path.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickProvince(p.name); } });
  hoverable(path, () => `${esc(p.name)} · ${p.records.toLocaleString("en")} observations`);
  provEls.set(p.name, path);
});
const dotR = n => Math.min(1 + Math.sqrt(n) * 0.55, 9);
const dotEls = M.dots.map(([x, y, n, prov]) => ({ c: el("circle", { cx: x, cy: y, r: dotR(n) }, gDots), prov }));
const gDiv = el("g", { class: "div-dots" }, nl);
let divEls = [];
const divMenu = document.getElementById("div-menu");
divMenu.innerHTML = `<span class="eyebrow">Botanical division</span>
  <button type="button" data-div="" aria-pressed="true"><i style="background:var(--dot);border-color:transparent"></i>All observations<b>${M.total.toLocaleString("en")}</b></button>
  ${M.divisions.map(d => `<button type="button" data-div="${esc(d.name)}" aria-pressed="false"><i style="background:${d.fill};border-color:${d.line}"></i>${esc(d.name)}<b>${d.total.toLocaleString("en")}</b></button>`).join("")}`;
divMenu.addEventListener("click", ev => {
  const b = ev.target.closest("button");
  if (b) { ev.stopPropagation(); pickDivision(b.dataset.div || null); }
});
function pickDivision(name) {
  state.division = name;
  divMenu.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.div || null) === name)));
  gDots.classList.toggle("muted", !!name);
  gDiv.replaceChildren();
  const d = name && M.divisions.find(q => q.name === name);
  // largest dots first, so small ones stay visible on top
  divEls = d ? [...d.dots].sort((a, b) => b[2] - a[2]).map(([x, y, n, prov]) =>
    ({ c: el("circle", { cx: x, cy: y, r: dotR(n), fill: d.fill, stroke: d.line }, gDiv), prov })) : [];
  filterDots();
  provincePanel();
}
function filterDots() {
  [...dotEls, ...divEls].forEach(({ c, prov }) => c.classList.toggle("off", !!state.province && prov !== state.province));
}
nl.addEventListener("click", () => pickProvince(null));
document.getElementById("map-cap").innerHTML = `<p><strong>Figure 3.</strong> ${M.total.toLocaleString("en")} observations
  with coordinates, grouped into ${M.dots.length.toLocaleString("en")} places; dot area grows with the number of
  observations at the place. With a botanical division picked in the menu, its observations are coloured
  (and sized by their own number at each place) and the other dots are dimmed. Coordinates are those of the place names in the records, so a record naming only a
  province or the whole country sits at its centre. Province boundaries as in 1934 (eleven provinces; the
  IJsselmeer polders were not yet land, apart from the Wieringermeer). ${M.outside} observations lie just off the
  1934 coastline.</p>`;

function pickProvince(name) {
  state.province = name && name !== state.province ? name : null;
  provEls.forEach((path, n) => {
    path.classList.toggle("on", n === state.province);
    path.classList.toggle("off", !!state.province && n !== state.province);
    if (n === state.province) path.parentNode.appendChild(path);    // draw its outline on top
  });
  filterDots();
  provincePanel();
}
function divisionCount(prov) {
  const d = state.division && M.divisions.find(q => q.name === state.division);
  if (!d) return "";
  const n = d.dots.filter(x => x[3] === prov).reduce((a, x) => a + x[2], 0);
  return `<dt>${esc(d.name)}</dt><dd>${n.toLocaleString("en")}</dd>`;
}
function provincePanel() {
  const box = document.getElementById("province");
  const p = state.province && M.provinces.find(q => q.name === state.province);
  if (!p) {
    box.innerHTML = `<p class="empty">Click a province to see its three most frequent observers. Click it again, or
      outside the map, to see the whole country.</p>`;
    return;
  }
  const max = Math.max(...p.top.map(t => t.records));
  box.innerHTML = `<span class="eyebrow">Province in 1934</span><h3>${esc(p.name)}</h3>
    <dl><dt>Observations</dt><dd>${p.records.toLocaleString("en")}</dd>${divisionCount(p.name)}<dt>Observers</dt><dd>${p.observers}</dd></dl>
    <div><span class="eyebrow">Top 3 observers · records</span></div>
    <div class="bars">${p.top.map(t => {
      const [fill, line] = DATA.categories[t.category] || DATA.categories.unknown;
      return `<div class="bar"><div class="row"><span>${esc(t.name)}</span><b>${t.records}</b></div>
        <div class="track"><div class="fill" style="width:${(t.records / max * 100).toFixed(1)}%;background:${fill};border-color:${line}"></div></div></div>`;
    }).join("")}</div>
    <p class="hint">Records naming the person as main or additional observer at places in ${esc(p.name)}. Bar colours as
      in Figure 1a (${p.top.map(t => CATEGORY_LABEL[t.category]).filter((v, i, a) => a.indexOf(v) === i).join(", ")}).</p>`;
}

/* ---------- 4. travelling women ---------- */
function womenTable() {
  const t = document.getElementById("women-table");
  const pct = v => `${Math.round(v * 100)}%`;
  t.innerHTML = `<thead><tr><th>Woman</th><th class="n">Records</th><th class="n">Provinces</th><th class="n">Places</th>
      <th class="n">Max. span</th><th class="n">Radius</th><th>Home</th><th class="n">At home</th><th class="n">Near home</th><th class="n">Years</th></tr></thead>
    <tbody>${DATA.women.map(w => `<tr><td>${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener">${esc(w.name)}</a>` : esc(w.name)}</td>
      <td class="n">${w.records}</td><td class="n">${w.provinces}</td><td class="n">${w.places}</td>
      <td class="n">${Math.round(w.span)} km</td><td class="n">${Math.round(w.radius)} km</td><td>${esc(w.home)}</td>
      <td class="n">${pct(w["home.share"])}</td><td class="n">${pct(w["near.home"])}</td>
      <td class="n">${w.first ? (w.first === w.last ? w.first : `${w.first}–${w.last}`) : "–"}</td></tr>`).join("")}</tbody>`;
}
function womenMaps() {
  const host = document.getElementById("women-maps");
  const siteR = n => Math.min(4 + Math.sqrt(n) * 3.2, 24);
  DATA.women.forEach(w => {
    const card = document.createElement("article");
    card.className = "woman";
    card.innerHTML = `<h3>${esc(w.name)}</h3>
      <p class="meta">${plural(w.records, "record")} · ${plural(w.provinces, "province")} · ${plural(w.places, "place")} · home: ${esc(w.home)}</p>`;
    // year menu: all years, each year she recorded in, and records without a year
    const years = [...new Set(w.sites.flatMap(x => Object.keys(x["by.year"])))].sort();
    const yearBar = document.createElement("div");
    yearBar.className = "years";
    yearBar.setAttribute("role", "group");
    yearBar.setAttribute("aria-label", `Years in which ${w.name} recorded`);
    const dated = years.filter(y => y);
    yearBar.innerHTML = (dated.length > 1 ? `<button type="button" class="play" aria-label="Play through the years">▶</button>` : "") +
      `<button type="button" data-year="*" aria-pressed="true">All years</button>` +
      years.map(y => `<button type="button" data-year="${y}" aria-pressed="false">${y || "no year"}</button>`).join("");
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", `0 0 ${M.width} ${M.height}`);
    s.setAttribute("role", "img");
    s.setAttribute("aria-label", `Map of the places where ${w.name} recorded`);
    const gp = el("g", {}, s), gs = el("g", {}, s);
    const info = document.createElement("p");
    info.className = "inprov";
    let picked = null, year = "*", timer = null;
    const paths = new Map();
    let sites = [];
    const recordsAt = x => year === "*" ? x.records : (x["by.year"][year] || 0);
    const update = () => {
      paths.forEach((path, n) => { path.classList.toggle("on", n === picked); path.classList.toggle("off", !!picked && n !== picked);
        if (n === picked) gp.appendChild(path); });
      yearBar.querySelectorAll("[data-year]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.year === year)));
      sites.forEach(({ c, ring, x }) => {
        const n = recordsAt(x);
        const off = n === 0 || (picked && x.province !== picked);
        c.setAttribute("r", siteR(n || x.records));
        c.classList.toggle("faded", off);
        if (ring) { ring.setAttribute("r", siteR(n || x.records) + 5); ring.classList.toggle("faded", off); }
        if (!off) gs.appendChild(c), ring && gs.appendChild(ring);   // shown places on top
      });
      const when = year === "*" ? "" : year ? `In ${year}` : "Without a year";
      const here = w.sites.filter(x => recordsAt(x) > 0 && (!picked || x.province === picked));
      const n = here.reduce((a, x) => a + recordsAt(x), 0);
      const placeNames = [...new Set(here.map(x => x.place))];
      if (!picked && !when) { info.textContent = "Pick a year, or click a province, to see her records there."; return; }
      const where = picked ? (when ? ` in ${picked}` : picked) : "";
      info.textContent = here.length
        ? `${when}${where}: ${plural(n, "record")} at ${plural(placeNames.length, "place")} (${placeNames.join(", ")}).`
        : `${when}${where}: no records with usable coordinates.`;
    };
    const pickHere = name => { picked = name && name !== picked ? name : null; update(); };
    const stop = () => { clearInterval(timer); timer = null; const b = yearBar.querySelector(".play"); if (b) { b.textContent = "▶"; b.setAttribute("aria-label", "Play through the years"); } };
    const pickYear = y => { year = y; update(); };
    yearBar.addEventListener("click", ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.classList.contains("play")) {
        if (timer) { stop(); return; }
        b.textContent = "❚❚"; b.setAttribute("aria-label", "Pause");
        let i = dated.indexOf(year) + 1;
        if (i <= 0 || i >= dated.length) i = 0;
        pickYear(dated[i]);
        timer = setInterval(() => { i += 1; if (i >= dated.length) { stop(); return; } pickYear(dated[i]); }, 1200);
        return;
      }
      stop();
      pickYear(b.dataset.year);
    });
    M.provinces.forEach(p => {
      const path = el("path", { d: p.path, class: "prov", "fill-rule": "evenodd" }, gp);
      path.addEventListener("click", ev => { ev.stopPropagation(); pickHere(p.name); });
      hoverable(path, () => esc(p.name));
      paths.set(p.name, path);
    });
    let ringDone = false;
    sites = [...w.sites].sort((a, b) => b.records - a.records).map(x => {
      const r = siteR(x.records);
      const c = el("circle", { class: "site", cx: x.xy[0], cy: x.xy[1], r, fill: x.fill, stroke: x.line, "fill-opacity": 0.85 }, gs);
      const ring = x.home && !ringDone ? el("circle", { class: "site-ring", cx: x.xy[0], cy: x.xy[1], r: r + 5 }, gs) : null;
      if (ring) ringDone = true;
      hoverable(c, () => {
        const yrs = Object.entries(x["by.year"]).sort().map(([y, n]) => `${y || "no year"}: ${n}`).join(" · ");
        return `<strong>${esc(x.place)}</strong> (${esc(x.province)})<br>${esc(x.division)}: ${plural(x.records, "record")}${yrs ? `<br>${esc(yrs)}` : ""}<br>${x.home ? "her home" : `${Math.round(x.km)} km from home`}`;
      });
      return { c, ring, x };
    });
    s.addEventListener("click", () => pickHere(null));
    card.appendChild(yearBar);
    card.appendChild(s);
    const key = document.createElement("p");
    key.className = "key";
    const divs = [...new Map(w.sites.map(x => [x.division, x])).values()];
    key.innerHTML = divs.map(x => `<span><i style="background:${x.fill};border-color:${x.line}"></i>${esc(x.division)}</span>`).join("");
    card.appendChild(key);
    card.appendChild(info);
    update();
    host.appendChild(card);
  });
  document.getElementById("women-cap").textContent = `Figure 4. Places where each woman recorded, on the 1934 provinces; circle
    colour gives the botanical division of the records (colours as in the map above), circle area grows with her
    records at the place, and a ring marks her home. Pick a year above a map, or press ▶ to step through
    her years, to show only the places of that year (circle area then counts that year's records); the records give a year
    but no date, so the order of places within a year is unknown. Hover over a circle for the place and its records per
    year; click a province to list her records there.`;
}

/* ---------- state ---------- */
function pick(id) {
  state.picked = id && id !== state.picked ? id : null;   // clicking the selected circle again clears it
  render();
}
function setView(view) {
  state.view = view;
  document.getElementById("view-observer").setAttribute("aria-pressed", view === "observer");
  document.getElementById("view-taxonomy").setAttribute("aria-pressed", view === "taxonomy");
  try { localStorage.setItem("fb-view", view); } catch (e) {}
  render();
}
function render() {
  nodeEls.forEach((parts, id) => paintNode(parts, byId.get(id)));
  labels();
  caption();
  pairCards();
  personPanel();
  highlight();
}
document.getElementById("view-observer").addEventListener("click", () => setView("observer"));
document.getElementById("view-taxonomy").addEventListener("click", () => setView("taxonomy"));
document.getElementById("clear").addEventListener("click", () => pick(null));
document.addEventListener("keydown", ev => { if (ev.key === "Escape") { pick(null); pickProvince(null); } });
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(labels, 150); });
let saved = "observer";
try { saved = localStorage.getItem("fb-view") || "observer"; } catch (e) {}
soloCards();
womenTable();
womenMaps();
provincePanel();
setView(saved === "taxonomy" ? "taxonomy" : "observer");
})();
