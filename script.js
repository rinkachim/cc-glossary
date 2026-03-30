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

    const categoryLine = restLines.find(l => l.trim().startsWith("category:"));
    const category = categoryLine ? categoryLine.replace("category:", "").trim() : "その他";

    const summaryLine = restLines.find(l => {
      const t = l.trim();
      return t && !t.startsWith("category:") && !t.startsWith("**【");
    });
    const summary = summaryLine ? summaryLine.trim() : "";

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

// 一覧用カード（<a>タグでCmd+クリック対応）
function renderCard(entry) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.term = entry.term.toLowerCase();
  card.dataset.summary = entry.summary.toLowerCase();
  card.dataset.category = entry.category;

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = "#" + encodeURIComponent(entry.term);
  link.innerHTML = `
    <div>
      <div class="card-meta"><span class="card-category">${entry.category}</span></div>
      <div class="card-title">${entry.term}</div>
      <div class="card-summary">${entry.summary}</div>
    </div>
    <div class="card-chevron">&#x203A;</div>
  `;

  link.addEventListener("click", () => {
    recordClick(entry.term);
  });

  card.appendChild(link);
  return card;
}

// 詳細ページを描画
function renderDetailPage(entry) {
  const container = document.getElementById("detail-content");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "detail-header";
  header.innerHTML = `
    <span class="card-category">${entry.category}</span>
    <h2 class="detail-title">${entry.term}</h2>
    <p class="detail-summary">${entry.summary}</p>
  `;
  container.appendChild(header);

  for (const section of entry.sections) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "detail-section";

    const h3 = document.createElement("h3");
    h3.textContent = section.label;
    sectionEl.appendChild(h3);

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
      sectionEl.appendChild(ul);
    } else {
      const p = document.createElement("p");
      p.innerHTML = section.content.replace(/`([^`]+)`/g, "<code>$1</code>");
      sectionEl.appendChild(p);
    }

    container.appendChild(sectionEl);
  }
}

// サイドバーアイテム（<a>タグでCmd+クリック対応）
function renderSidebarItem(entry) {
  const item = document.createElement("a");
  item.className = "sidebar-item";
  item.href = "#" + encodeURIComponent(entry.term);
  item.innerHTML = `<span class="card-category">${entry.category}</span><span class="sidebar-term">${entry.term}</span>`;
  item.addEventListener("click", () => {
    recordClick(entry.term);
  });
  return item;
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
      // カテゴリ選択時は一覧に戻る
      if (location.hash) {
        history.pushState(null, "", location.pathname);
      }
      wrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      onSelect(cat === "すべて" ? null : cat);
    });
    wrap.appendChild(chip);
  });
}

function renderSidebar(entries, prefix) {
  const recentSection = document.getElementById(prefix + "recent-section");
  const recentGrid = document.getElementById(prefix + "recent-cards");
  recentGrid.innerHTML = "";
  const recent = entries.slice(-5).reverse();
  recent.forEach(e => recentGrid.appendChild(renderSidebarItem(e)));
  recentSection.style.display = recent.length ? "" : "none";

  const popularSection = document.getElementById(prefix + "popular-section");
  const popularGrid = document.getElementById(prefix + "popular-cards");
  popularGrid.innerHTML = "";
  const clicks = getClicks();
  const popular = entries
    .filter(e => clicks[e.term])
    .sort((a, b) => (clicks[b.term] || 0) - (clicks[a.term] || 0))
    .slice(0, 5);
  popular.forEach(e => popularGrid.appendChild(renderSidebarItem(e)));
  popularSection.style.display = popular.length ? "" : "none";
}

function filterCards(query, categoryFilter, allCards) {
  const q = query.toLowerCase();
  let visible = 0;
  for (const card of allCards) {
    const matchQuery = !q || card.dataset.term.includes(q) || card.dataset.summary.includes(q);
    const matchCat = !categoryFilter || card.dataset.category === categoryFilter;
    const show = matchQuery && matchCat;
    card.style.display = show ? "" : "none";
    if (show) visible++;
  }
  document.getElementById("empty").style.display = visible === 0 ? "block" : "none";
}

// ビュー切り替え
function showListView() {
  document.getElementById("list-view").style.display = "";
  document.getElementById("detail-view").style.display = "none";
  document.title = "テック用語辞典";
  window.scrollTo(0, 0);
}

function showDetailView(entry, entries) {
  document.getElementById("list-view").style.display = "none";
  document.getElementById("detail-view").style.display = "";
  document.title = `${entry.term} - テック用語辞典`;
  renderDetailPage(entry);
  renderSidebar(entries, "detail-");
  window.scrollTo(0, 0);
}

async function init() {
  const entries = await loadGlossary();
  const cardsGrid = document.getElementById("cards");
  const search = document.getElementById("search");

  let currentCategory = null;

  const allCards = entries.map(e => renderCard(e));
  allCards.forEach(c => cardsGrid.appendChild(c));

  renderCategoryChips(entries, cat => {
    currentCategory = cat;
    filterCards(search.value, currentCategory, allCards);
  });

  renderSidebar(entries, "");

  // 検索（詳細ページにいたら一覧に戻る）
  search.addEventListener("input", () => {
    if (location.hash) {
      history.pushState(null, "", location.pathname);
      showListView();
    }
    filterCards(search.value, currentCategory, allCards);
  });

  // ハッシュルーティング
  function handleRoute() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      const entry = entries.find(e => e.term === hash);
      if (entry) {
        showDetailView(entry, entries);
        return;
      }
    }
    showListView();
    renderSidebar(entries, "");
  }

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("popstate", handleRoute);
  handleRoute();
}

init();
