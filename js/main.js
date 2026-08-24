let students = [];
let currentIndex = 0;
let currentType = "spaceship";

const galleryImage = document.getElementById("gallery-image");
const viewerTabs = document.getElementById("viewer-tabs");
const viewerMarquee = document.getElementById("viewer-marquee");
const viewerMarqueeTrack = document.getElementById("viewer-marquee-track");
const dragStage = document.getElementById("drag-stage");

const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");
const modalImage1 = document.getElementById("modal-image-1");
const modalImage2 = document.getElementById("modal-image-2");
const modalText = document.getElementById("modal-text");

const siteSearch = document.getElementById("site-search");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const revealToggle = document.getElementById("reveal-toggle");
const revealToggleLabel = document.getElementById("reveal-toggle-label");

// Runes + hanja, purely decorative - each character deterministically maps to
// one of these so the "cipher" always reads the same way, like a secret script.
// Hieroglyphs live outside the Basic Multilingual Plane, so each one is 2
// UTF-16 code units - built from real, contiguously-assigned code points
// (U+13000 onward) and split with Array.from so indexing lands on whole
// characters instead of stray surrogate halves.
const HIEROGLYPHS = Array.from({ length: 8 }, (_, i) => String.fromCodePoint(0x13000 + i)).join("");
// Deliberately obscure hanja (not everyday-use characters) so the cipher
// isn't easy to half-read at a glance.
const HANJA = "饕餮狻猊魍魎蛟鵬曦翳黝矍彧昶玥奭龘";
const CIPHER_SYMBOLS = Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚻᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ" + HANJA + HIEROGLYPHS);
let modalPlainText = "";
let siteRevealed = false; // global: false = whole site shows as cipher text

function toCipher(text) {
  return text.replace(/\S/g, (ch) => CIPHER_SYMBOLS[ch.codePointAt(0) % CIPHER_SYMBOLS.length]);
}

// Every piece of visible text should route through this so one toggle covers
// the whole site instead of each part managing its own hidden/shown state.
function displayText(text) {
  return siteRevealed ? text : toCipher(text);
}

function renderModalText() {
  modalText.textContent = displayText(modalPlainText);
  modalText.classList.toggle("encoded", !siteRevealed);
}

// Static HTML text (marked with [data-cipher]) - stash the real text once,
// then re-derive the displayed text from that stash every time state flips.
function applyCipherStatic() {
  document.querySelectorAll("[data-cipher]").forEach((el) => {
    if (el.dataset.plain === undefined) el.dataset.plain = el.textContent;
    el.textContent = displayText(el.dataset.plain);
  });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Re-derives every visible piece of text on the page from the current
// siteRevealed state. The reveal-toggle button's own label is the one
// exception - it stays legible always, since it's the key to the puzzle.
function applyRevealState() {
  applyCipherStatic();
  searchInput.placeholder = displayText("Search");
  renderGallery();
  renderMarquee();
  renderModalText();
  if (searchInput.value.trim()) runSearch(searchInput.value);
  revealToggleLabel.textContent = siteRevealed ? toCipher("외계어") : "번역";
  revealToggle.classList.toggle("active", siteRevealed);
  revealToggle.setAttribute("aria-checked", String(siteRevealed));
}

function setupRevealToggle() {
  revealToggle.addEventListener("click", () => {
    siteRevealed = !siteRevealed;
    applyRevealState();
  });
}

function getWork(index, type) {
  const student = students[index];
  return student ? student[type] : null;
}

function getRotate(work) {
  return work && work.rotate ? work.rotate : 0;
}

function studentLabel(index) {
  const student = students[index];
  const name = student ? student.student : "";
  const label = name && name !== "학생 이름 입력" ? name : pad(index + 1);
  return displayText(label);
}

function renderGallery() {
  const work = getWork(currentIndex, currentType);

  galleryImage.src = work ? work.image : "images/placeholder.svg";
  galleryImage.alt = work ? work.title : "";
  galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;

  viewerTabs.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === currentType);
  });

  viewerMarqueeTrack.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.index) === currentIndex);
  });
}

function renderMarquee() {
  const items = students
    .map((_, i) => `<button data-index="${i}" type="button">${studentLabel(i)}</button>`)
    .join("");

  // One copy needs to be measured before we know how many copies are needed.
  viewerMarqueeTrack.innerHTML = items;
  const singleWidth = viewerMarqueeTrack.scrollWidth || 1;
  const viewportWidth = viewerMarquee.clientWidth || window.innerWidth;

  // Repeat enough copies that the track is always wider than one viewport's
  // worth PLUS one full copy. Wrapping the scroll offset within a single
  // copy's width only stays seamless if there's always at least that much
  // real content ahead of the visible window - on a wide screen, 2 copies
  // isn't always enough and the scroll can run past the end of the track
  // into blank space before it wraps back to the start.
  const copies = Math.max(2, Math.ceil(viewportWidth / singleWidth) + 1);
  viewerMarqueeTrack.innerHTML = items.repeat(copies);
  viewerMarqueeTrack.dataset.singleWidth = singleWidth;

  viewerMarqueeTrack.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => goTo(Number(btn.dataset.index)));
  });
}

// Drives the marquee scroll from JS with requestAnimationFrame instead of a
// CSS "infinite" keyframe animation. CSS animations that loop forever can
// stutter or blank out right at the restart point in some browsers (a known
// compositor/repaint quirk) - computing the offset ourselves every frame and
// wrapping it with modulo never "restarts" anything, so there's no seam for
// that bug to happen at.
function setupMarqueeAnimation() {
  const speed = 44; // px per second - a bit slower than the old 56
  let paused = false;
  let lastTime = null;
  let offset = 0;

  viewerMarquee.addEventListener("mouseenter", () => {
    paused = true;
  });
  viewerMarquee.addEventListener("mouseleave", () => {
    paused = false;
  });

  function frame(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    // Clamp so a backgrounded/throttled tab doesn't produce one huge jump
    // in offset when it comes back into view.
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    const singleWidth = Number(viewerMarqueeTrack.dataset.singleWidth) || 0;
    if (!paused && singleWidth > 0) {
      offset = (offset + speed * dt) % singleWidth;
      viewerMarqueeTrack.style.transform = `translateX(${-offset}px)`;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // A wider window can need more copies of the list than were built at load
  // (see renderMarquee) - rebuild on resize so there's still always enough
  // real content ahead of the scroll position.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderMarquee();
      renderGallery();
    }, 200);
  });
}

function goTo(index) {
  // Wraps instead of clamping, so dragging past the ends can cross 19 <-> 01.
  currentIndex = ((index % students.length) + students.length) % students.length;
  renderGallery();
}

function setType(type) {
  currentType = type;
  renderGallery();
}

function setupViewerTabs() {
  viewerTabs.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setType(btn.dataset.type));
  });
}

function openModal(student) {
  if (!student) return;
  const spaceship = student.spaceship;
  const spacesuit = student.spacesuit;
  modalImage1.src = spaceship ? spaceship.image : "images/placeholder.svg";
  modalImage1.alt = "우주선";
  modalImage2.src = spacesuit ? spacesuit.image : "images/placeholder.svg";
  modalImage2.alt = "우주복";
  modalPlainText = student.text || "";
  renderModalText();
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

function setupModal() {
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  });
}

function setupDrag() {
  let startX = 0; // fixed at pointerdown, used only to detect a "click" (no real drag)
  let baseX = 0; // rebased every time a step is consumed
  let dragging = false;
  const dragThreshold = 60;
  const clickThreshold = 5;

  // Crosses as many thresholds as the current pointer position allows (handles
  // fast flicks that jump past more than one student in a single move event),
  // rebasing baseX each time so the remaining offset is the leftover drag past
  // the last step. Wraps around at the first/last student (19 -> 01, 01 -> 19).
  const consumeSteps = (clientX) => {
    let delta = clientX - baseX;
    while (true) {
      if (delta <= -dragThreshold) {
        goTo((currentIndex + 1) % students.length);
        baseX -= dragThreshold;
      } else if (delta >= dragThreshold) {
        goTo((currentIndex - 1 + students.length) % students.length);
        baseX += dragThreshold;
      } else {
        break;
      }
      delta = clientX - baseX;
    }
    return delta;
  };

  const onDown = (e) => {
    // Without this, starting a drag from outside the image (or over text)
    // kicks off the browser's native text/image selection instead of our
    // drag - the visible symptom was a blue selection highlight while
    // trying to drag through the gallery.
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    baseX = e.clientX;
    dragStage.classList.add("dragging");
    dragStage.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;
    consumeSteps(e.clientX);
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    dragStage.classList.remove("dragging");

    consumeSteps(e.clientX);
    const totalDelta = e.clientX - startX;

    if (Math.abs(totalDelta) < clickThreshold) {
      openModal(students[currentIndex]);
    }
  };

  dragStage.addEventListener("pointerdown", onDown);
  dragStage.addEventListener("pointermove", onMove);
  dragStage.addEventListener("pointerup", onUp);
  dragStage.addEventListener("pointercancel", onUp);

  // Belt-and-suspenders alongside the pointerdown preventDefault and the
  // user-select: none on .drag-stage - this cancels the browser's "start a
  // text/image selection" action directly, regardless of which underlying
  // event (mouse vs. pointer vs. touch) triggered it. Listens on the whole
  // document (not just .drag-stage) because a mousedown inside a
  // non-selectable element like <img> can make the browser anchor the
  // selection on the nearest text it finds instead - e.g. the caption below
  // the image - which is outside .drag-stage and wouldn't bubble through it.
  document.addEventListener("selectstart", (e) => {
    if (dragging) e.preventDefault();
  });
}

function findSnippet(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + query.length + 20);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function runSearch(query) {
  const q = query.trim();
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const matches = students
    .map((s, i) => ({ index: i, snippet: findSnippet(s.text || "", q) }))
    .filter((m) => m.snippet !== null);

  searchResults.innerHTML = matches.length
    ? matches
        .map(
          (m) => `
            <button type="button" data-index="${m.index}">
              <span class="result-name">${escapeHtml(studentLabel(m.index))}</span>
              <span class="result-snippet">${escapeHtml(displayText(m.snippet))}</span>
            </button>
          `
        )
        .join("")
    : `<div class="result-empty">${escapeHtml(displayText("검색 결과가 없습니다"))}</div>`;

  searchResults.querySelectorAll("button[data-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      goTo(index);
      openModal(students[index]);
      searchResults.hidden = true;
      searchInput.value = "";
    });
  });

  searchResults.hidden = false;
}

function setupSearch() {
  searchInput.addEventListener("input", (e) => runSearch(e.target.value));
  searchInput.addEventListener("focus", (e) => {
    if (e.target.value.trim()) searchResults.hidden = false;
  });
  document.addEventListener("click", (e) => {
    if (!siteSearch.contains(e.target)) searchResults.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") searchResults.hidden = true;
  });
}

async function init() {
  const res = await fetch("data/works.json", { cache: "no-store" });
  students = await res.json();
  applyCipherStatic();
  searchInput.placeholder = displayText("Search");
  revealToggleLabel.textContent = siteRevealed ? toCipher("외계어") : "번역";
  revealToggle.classList.toggle("active", siteRevealed);
  revealToggle.setAttribute("aria-checked", String(siteRevealed));
  renderMarquee();
  renderGallery();
  setupDrag();
  setupModal();
  setupViewerTabs();
  setupSearch();
  setupRevealToggle();
  setupMarqueeAnimation();
}

init();
