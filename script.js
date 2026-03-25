const SECTION_LABELS = {
  "CCがこれを使うとき、何が起きているか": "CCがこれを使うとき",
  "挙動イメージ": "挙動イメージ",
  "実例": "実例",
  "あなたが知っておくべきこと": "知っておくべきこと"
};

const POPULAR_KEY = "glossary_clicks";

function getClicks() {
  try { return JSON.parse(localStorage.getItem(POPULAR_KEY) || "{}"); }
  catch { return {}; }
}

function recordClick(term) {
  const clicks = getClicks();
  clicks[term] = (clicks[term] || 0) + 1;
  localStorage.setItem(POPULAR_KEY, JSON.stringify(clicks));
}

async function loadGlossary() {
  const res = await fetch("glossary.md");
  const text = await res.text();
  return parseGlossary(text);
}

function parseGlossary(text) {
  const entries = [];
  const blocks = text.split(/^## /m).slice(1);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const term = lines[0].trim();
    const restLines = lines.slice(1);

    // category行
    const categoryLine = restLines.find(l => l.trim().startsWith("category:"));
    const category = categoryLine ? categoryLine.replace("category:", "").trim() : "その他";

    // 一言説明（category行・空行・**【 以外の最初の行）
    const summaryLine = restLines.find(l => {
      const t = l.trim();
      return t && !t.startsWith("category:") && !t.startsWith("**【");
    });
    const summary = summaryLine ? summaryLine.trim() : "";

    // セクションを行単位で抽出
    const sections = [];
    let currentLabel = null;
    let currentLines = [];

    for (const line of restLines) {
      const m = line.match(/^\*\*【(.+?)】\*\*$/);
      if (m) {
        if (currentLabel !== null) {
          sections.push({
            label: SECTION_LABELS[currentLabel] || currentLabel,
            content: currentLines.join("\n").trim()
          });
        }
        currentLabel = m[1];
        currentLines = [];
      } else if (currentLabel !== null) {
        currentLines.push(line);
      }
    }
    if (currentLabel !== null) {
      sections.push({
        label: SECTION_LABELS[currentLabel] || currentLabel,
        content: currentLines.join("\n").trim()
      });
    }

    entries.push({ term, category, summary, sections });
  }

  return entries;
}

function renderCard(entry, mini = false) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.term = entry.term.toLowerCase();
  card.dataset.summary = entry.summary.toLowerCase();
  card.dataset.category = entry.category;

  const header = document.createElement("div");
  header.className = "card-header";

  const info = document.createElement("div");
  info.innerHTML = `
    <div class="card-meta"><span class="card-category">${entry.category}</span></div>
    <div class="card-title">${entry.term}</div>
    <div class="card-summary">${entry.summary}</div>
  `;

  const chevron = document.createElement("div");
  chevron.className = "card-chevron";
  chevron.textContent = "▼";

  header.appendChild(info);
  header.appendChild(chevron);

  const body = document.createElement("div");
  body.className = "card-body";

  for (const section of entry.sections) {
    const h3 = document.createElement("h3");
    h3.textContent = section.label;
    body.appendChild(h3);

    const lines = section.content.split("\n");
    if (lines.some(l => l.startsWith("- "))) {
      const ul = document.createElement("ul");
      for (const line of lines) {
        if (line.startsWith("- ")) {
          const li = document.createElement("li");
          li.innerHTML = line.slice(2).replace(/`([^`]+)`/g, "<code>$1</code>");
          ul.appendChild(li);
        }
      }
      body.appendChild(ul);
    } else {
      const p = document.createElement("p");
      p.innerHTML = section.content.replace(/`([^`]+)`/g, "<code>$1</code>");
      body.appendChild(p);
    }
  }

  card.appendChild(header);
  card.appendChild(body);

  card.addEventListener("click", () => {
    card.classList.toggle("open");
    recordClick(entry.term);
  });

  return card;
}

function renderCategoryChips(entries, onSelect) {
  const categories = ["すべて", ...new Set(entries.map(e => e.category))];
  const wrap = document.getElementById("category-chips");
  wrap.innerHTML = "";
  categories.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "chip" + (cat === "すべて" ? " active" : "");
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      wrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      onSelect(cat === "すべて" ? null : cat);
    });
    wrap.appendChild(chip);
  });
}

function renderRecentSection(entries) {
  const section = document.getElementById("recent-section");
  const grid = document.getElementById("recent-cards");
  grid.innerHTML = "";
  const recent = entries.slice(-4).reverse();
  recent.forEach(e => grid.appendChild(renderCard(e)));
  section.style.display = recent.length ? "" : "none";
}

function renderPopularSection(entries) {
  const section = document.getElementById("popular-section");
  const grid = document.getElementById("popular-cards");
  grid.innerHTML = "";
  const clicks = getClicks();
  const popular = entries
    .filter(e => clicks[e.term])
    .sort((a, b) => (clicks[b.term] || 0) - (clicks[a.term] || 0))
    .slice(0, 4);
  popular.forEach(e => grid.appendChild(renderCard(e)));
  section.style.display = popular.length ? "" : "none";
}

function filterCards(query, categoryFilter, allCards) {
  const q = query.toLowerCase();
  let visible = 0;
  for (const card of allCards) {
    const matchQuery = !q || card.dataset.term.includes(q) || card.dataset.summary.includes(q);
    const matchCat = !categoryFilter || card.dataset.category === categoryFilter;
    const show = matchQuery && matchCat;
    card.style.display = show ? "" : "none";
    card.classList.remove("open");
    if (show) visible++;
  }
  document.getElementById("empty").style.display = visible === 0 ? "block" : "none";
}

async function init() {
  const entries = await loadGlossary();
  const cardsGrid = document.getElementById("cards");
  const search = document.getElementById("search");

  let currentCategory = null;

  // 全カードを描画
  const allCards = entries.map(e => renderCard(e));
  allCards.forEach(c => cardsGrid.appendChild(c));

  // カテゴリチップ
  renderCategoryChips(entries, cat => {
    currentCategory = cat;
    filterCards(search.value, currentCategory, allCards);
    toggleSections(search.value, currentCategory);
  });

  // 最近追加・よく開かれた
  renderRecentSection(entries);
  renderPopularSection(entries);

  // 検索
  search.addEventListener("input", () => {
    filterCards(search.value, currentCategory, allCards);
    toggleSections(search.value, currentCategory);
  });

  function toggleSections(query, cat) {
    const hide = query || cat;
    document.getElementById("recent-section").style.display = hide ? "none" : "";
    document.getElementById("popular-section").style.display =
      (hide || !Object.keys(getClicks()).length) ? "none" : "";
  }
}

init();
