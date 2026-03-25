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
    const restLines = lines.slice(1);

    // 一言説明（**【 で始まらない最初の非空行）
    const summaryLine = restLines.find(l => l.trim() && !l.startsWith("**【"));
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
