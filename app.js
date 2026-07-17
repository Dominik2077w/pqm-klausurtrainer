const DATA_URL = "data/cards.json";
const STORE_KEY = "pqm-klausurtrainer-progress-v1";

const state = {
  data: null,
  cards: [],
  filtered: [],
  queue: [],
  index: 0,
  revealed: false,
  progress: loadProgress(),
  filters: {
    chapter: "all",
    kind: "all",
    priority: "all",
    search: "",
    dueOnly: false,
    weakOnly: false,
    teacherHintOnly: false,
  },
};

const els = {
  chapterFilter: document.querySelector("#chapter-filter"),
  kindFilter: document.querySelector("#kind-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  searchInput: document.querySelector("#search-input"),
  dueOnly: document.querySelector("#due-only"),
  weakOnly: document.querySelector("#weak-only"),
  teacherHintOnly: document.querySelector("#teacher-hint-only"),
  chapterList: document.querySelector("#chapter-list"),
  statTotal: document.querySelector("#stat-total"),
  statDue: document.querySelector("#stat-due"),
  statKnown: document.querySelector("#stat-known"),
  statProgress: document.querySelector("#stat-progress"),
  queueCount: document.querySelector("#queue-count"),
  cardPosition: document.querySelector("#card-position"),
  cardChapter: document.querySelector("#card-chapter"),
  cardKind: document.querySelector("#card-kind"),
  cardPriority: document.querySelector("#card-priority"),
  cardHint: document.querySelector("#card-hint"),
  cardFront: document.querySelector("#card-front"),
  cardAnswer: document.querySelector("#card-answer"),
  cardBack: document.querySelector("#card-back"),
  cardSource: document.querySelector("#card-source"),
  cardReason: document.querySelector("#card-reason"),
  cardHintReason: document.querySelector("#card-hint-reason"),
  cardHintBlock: document.querySelector("#card-hint-block"),
  showAnswerBtn: document.querySelector("#show-answer-btn"),
  gradeActions: document.querySelector("#grade-actions"),
  emptyState: document.querySelector("#empty-state"),
  shuffleBtn: document.querySelector("#shuffle-btn"),
  resetSessionBtn: document.querySelector("#reset-session-btn"),
  clearProgressBtn: document.querySelector("#clear-progress-btn"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  browseCount: document.querySelector("#browse-count"),
  cardTable: document.querySelector("#card-table"),
};

init();

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}`);
  }
  state.data = await response.json();
  state.cards = state.data.cards;
  buildFilters();
  bindEvents();
  applyFilters();
}

function buildFilters() {
  els.chapterFilter.innerHTML = "";
  els.chapterFilter.append(new Option("Alle Kapitel", "all"));
  for (const chapter of state.data.chapters) {
    const suffix = chapter.total ? `${chapter.total} Karten` : "übersprungen";
    els.chapterFilter.append(new Option(`K${chapter.chapterNo}: ${chapter.title.replace(/^Kapitel \d+\s*/, "")} (${suffix})`, String(chapter.chapterNo)));
  }

  els.chapterList.innerHTML = state.data.chapters
    .map((chapter) => {
      const tip = chapter.teacherHint ? ` · ${chapter.teacherHint} Tipps` : "";
      const status = chapter.total ? `${chapter.memorize} 要背 · ${chapter.skill} 要会${tip}` : "nicht prüfungsaktiv";
      return `
        <div class="chapter-row">
          <div>
            <strong>K${String(chapter.chapterNo).padStart(2, "0")} ${escapeHtml(chapter.title.replace(/^Kapitel \d+\s*/, ""))}</strong>
            <span>${escapeHtml(status)}</span>
          </div>
          <span class="chapter-count">${chapter.total}</span>
        </div>
      `;
    })
    .join("");
}

function bindEvents() {
  els.chapterFilter.addEventListener("change", () => {
    state.filters.chapter = els.chapterFilter.value;
    applyFilters();
  });
  els.kindFilter.addEventListener("change", () => {
    state.filters.kind = els.kindFilter.value;
    applyFilters();
  });
  els.priorityFilter.addEventListener("change", () => {
    state.filters.priority = els.priorityFilter.value;
    applyFilters();
  });
  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value.trim().toLowerCase();
    applyFilters();
  });
  els.dueOnly.addEventListener("change", () => {
    state.filters.dueOnly = els.dueOnly.checked;
    applyFilters();
  });
  els.weakOnly.addEventListener("change", () => {
    state.filters.weakOnly = els.weakOnly.checked;
    applyFilters();
  });
  els.teacherHintOnly.addEventListener("change", () => {
    state.filters.teacherHintOnly = els.teacherHintOnly.checked;
    applyFilters();
  });
  els.showAnswerBtn.addEventListener("click", revealAnswer);
  document.querySelectorAll(".grade-btn").forEach((button) => {
    button.addEventListener("click", () => gradeCurrent(button.dataset.grade));
  });
  els.shuffleBtn.addEventListener("click", () => {
    shuffle(state.queue);
    state.index = 0;
    state.revealed = false;
    render();
  });
  els.resetSessionBtn.addEventListener("click", () => {
    state.index = 0;
    state.revealed = false;
    state.queue = [...state.filtered];
    render();
  });
  els.clearProgressBtn.addEventListener("click", clearProgress);
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select")) return;
    if (event.key === " ") {
      event.preventDefault();
      if (!state.revealed) revealAnswer();
    }
    if (state.revealed && ["1", "2", "3"].includes(event.key)) {
      const grade = { "1": "again", "2": "hard", "3": "good" }[event.key];
      gradeCurrent(grade);
    }
  });
}

function switchView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}-view`));
}

function applyFilters() {
  const now = Date.now();
  state.filtered = state.cards.filter((card) => {
    const progress = state.progress[card.id] || {};
    if (state.filters.chapter !== "all" && String(card.chapterNo) !== state.filters.chapter) return false;
    if (state.filters.kind !== "all" && card.kind !== state.filters.kind) return false;
    if (state.filters.priority !== "all") {
      const selected = Number(state.filters.priority);
      if (selected === 3 && card.priority < 3) return false;
      if (selected !== 3 && card.priority !== selected) return false;
    }
    if (state.filters.dueOnly && (progress.nextReview || 0) > now) return false;
    if (state.filters.weakOnly && !isWeak(progress)) return false;
    if (state.filters.teacherHintOnly && !card.teacherHint) return false;
    if (state.filters.search) {
      const haystack = [card.front, card.back, card.source, card.whyExamRelevant, card.teacherHintReason, card.chapter, ...(card.tags || [])]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(state.filters.search)) return false;
    }
    return true;
  });
  state.queue = [...state.filtered];
  state.index = 0;
  state.revealed = false;
  render();
}

function render() {
  renderStats();
  renderBrowse();

  const card = state.queue[state.index];
  els.emptyState.hidden = Boolean(card);
  document.querySelector(".flashcard").hidden = !card;

  els.queueCount.textContent = `${state.queue.length} Karten im aktuellen Stapel`;
  els.cardPosition.textContent = card ? `${state.index + 1} / ${state.queue.length}` : "0 / 0";

  if (!card) return;

  els.cardChapter.textContent = `K${String(card.chapterNo).padStart(2, "0")}`;
  els.cardKind.textContent = card.kind === "memorize" ? "要背" : "要会";
  els.cardPriority.textContent = `P${card.priority}`;
  els.cardHint.hidden = !card.teacherHint;
  els.cardFront.textContent = card.front;
  els.cardBack.textContent = card.back;
  els.cardSource.textContent = card.source || "Keine Quelle hinterlegt.";
  els.cardReason.textContent = card.whyExamRelevant || "Keine separate Begründung hinterlegt.";
  els.cardHintBlock.hidden = !card.teacherHint;
  els.cardHintReason.textContent = card.teacherHintReason || "Vom Dozenten als besonders prüfungsnah markiert.";
  els.cardAnswer.hidden = !state.revealed;
  els.showAnswerBtn.hidden = state.revealed;
  els.gradeActions.hidden = !state.revealed;
}

function renderStats() {
  const now = Date.now();
  const total = state.cards.length;
  const seen = state.cards.filter((card) => state.progress[card.id]?.seen).length;
  const known = state.cards.filter((card) => (state.progress[card.id]?.streak || 0) >= 2).length;
  const due = state.cards.filter((card) => (state.progress[card.id]?.nextReview || 0) <= now).length;

  els.statTotal.textContent = total;
  els.statDue.textContent = due;
  els.statKnown.textContent = known;
  els.statProgress.textContent = total ? `${Math.round((seen / total) * 100)}%` : "0%";
}

function renderBrowse() {
  els.browseCount.textContent = `${state.filtered.length} Karten`;
  els.cardTable.innerHTML = state.filtered
    .map((card) => `
      <article class="browse-card${card.teacherHint ? " is-hint" : ""}">
        <div class="card-meta">
          <span class="pill">K${String(card.chapterNo).padStart(2, "0")}</span>
          <span class="pill">${card.kind === "memorize" ? "要背" : "要会"}</span>
          <span class="pill">P${card.priority}</span>
          ${card.teacherHint ? '<span class="pill hint-pill">Dozententipp</span>' : ""}
        </div>
        <h3>${escapeHtml(card.front)}</h3>
        <p>${escapeHtml(card.back)}</p>
      </article>
    `)
    .join("");
}

function revealAnswer() {
  state.revealed = true;
  render();
}

function gradeCurrent(grade) {
  const card = state.queue[state.index];
  if (!card) return;

  const previous = state.progress[card.id] || {};
  const now = Date.now();
  const next = {
    seen: true,
    correct: previous.correct || 0,
    wrong: previous.wrong || 0,
    hard: previous.hard || 0,
    streak: previous.streak || 0,
    lastGrade: grade,
    lastSeen: now,
    nextReview: now,
  };

  if (grade === "again") {
    next.wrong += 1;
    next.streak = 0;
    next.nextReview = now + 5 * 60 * 1000;
  } else if (grade === "hard") {
    next.hard += 1;
    next.streak = 0;
    next.nextReview = now + 24 * 60 * 60 * 1000;
  } else {
    next.correct += 1;
    next.streak += 1;
    const days = next.streak >= 3 ? 7 : next.streak >= 2 ? 3 : 1;
    next.nextReview = now + days * 24 * 60 * 60 * 1000;
  }

  state.progress[card.id] = next;
  saveProgress(state.progress);

  if (state.index < state.queue.length - 1) {
    state.index += 1;
  } else {
    state.index = 0;
  }
  state.revealed = false;
  render();
}

function clearProgress() {
  const confirmed = window.confirm(
    "Alle Lernstände für diese Seite löschen? Die Karten starten danach wieder bei null."
  );
  if (!confirmed) return;

  state.progress = {};
  localStorage.removeItem(STORE_KEY);
  state.index = 0;
  state.revealed = false;
  state.queue = [...state.filtered];
  render();
}

function isWeak(progress) {
  if (!progress.seen) return true;
  if ((progress.wrong || 0) > (progress.correct || 0)) return true;
  if (progress.lastGrade === "again" || progress.lastGrade === "hard") return true;
  return false;
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORE_KEY, JSON.stringify(progress));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
