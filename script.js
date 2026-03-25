const SECTION_LABELS = {
  "CCがこれを使うとき、何が起きているか": "CCがこれを使うとき",
  "挙動イメージ": "挙動イメージ",
  "実例": "実例",
  "あなたが知っておくべきこと": "知っておくべきこと"
};

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
    const rest = lines.slice(1).join("\n").trim();

    // 一言説明（最初の段落）
    const summaryMatch = rest.match(/^([^*\n][^\n]+)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";

    // セクションを抽出
    const sections = [];
    const sectionRegex = /\*\*【(.+?)】\*\*\n([\s\S]*?)(?=\n\*\*【|\s*$)/g;
    let m;
    while ((m = sectionRegex.exec(rest)) !== null) {
      const label = SECTION_LABELS[m[1]] || m[1];
      const content = m[2].trim();
      sections.push({ label, content });
    }

    entries.push({ term, summary, sections });
  }

  return entries;
}

function renderCard(entry) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.term = entry.term.toLowerCase();
  card.dataset.summary = entry.summary.toLowerCase();

  const header = document.createElement("div");
  header.className = "card-header";

  const info = document.createElement("div");
  info.innerHTML = `
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
  });

  return card;
}

function filterCards(query, cards) {
  const q = query.toLowerCase();
  let visible = 0;
  for (const card of cards) {
    const match = !q || card.dataset.term.includes(q) || card.dataset.summary.includes(q);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  }
  document.getElementById("empty").style.display = visible === 0 ? "block" : "none";
}

async function init() {
  const main = document.getElementById("cards");
  const search = document.getElementById("search");
  const entries = await loadGlossary();
  const cards = entries.map(renderCard);
  cards.forEach(c => main.appendChild(c));

  search.addEventListener("input", () => filterCards(search.value, cards));
}

init();
