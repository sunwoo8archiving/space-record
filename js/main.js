let students = [];
let currentIndex = 0;
let currentType = "spaceship";

const galleryImage = document.getElementById("gallery-image");
const viewerStudent = document.getElementById("viewer-student");
const viewerTabs = document.getElementById("viewer-tabs");
const viewerMarquee = document.getElementById("viewer-marquee");
const viewerMarqueeTrack = document.getElementById("viewer-marquee-track");
const counter = document.getElementById("counter");
const dragStage = document.getElementById("drag-stage");
const galleryFloat = document.getElementById("gallery-float");
const views = {
  gallery: document.getElementById("view-gallery"),
  info: document.getElementById("view-info"),
};

const modalOverlay = document.getElementById("modal-overlay");
const modalClose = document.getElementById("modal-close");
const modalImage1 = document.getElementById("modal-image-1");
const modalImage2 = document.getElementById("modal-image-2");
const modalText = document.getElementById("modal-text");

const siteSearch = document.getElementById("site-search");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const revealToggle = document.getElementById("reveal-toggle");

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

function currentViewName() {
  return Object.keys(views).find((key) => !views[key].hidden);
}

function updateNavLabels() {
  const name = currentViewName();
  document.querySelectorAll(".site-nav [data-view]").forEach((btn) => {
    const isActive = btn.dataset.view === name;
    btn.classList.toggle("active", isActive);
    btn.textContent = displayText(isActive ? "Close" : btn.dataset.label);
  });
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  updateNavLabels();
  if (name === "gallery") renderGallery();
}

// Re-derives every visible piece of text on the page from the current
// siteRevealed state. The reveal-toggle button's own label is the one
// exception - it stays legible always, since it's the key to the puzzle.
function applyRevealState() {
  applyCipherStatic();
  searchInput.placeholder = displayText("Search");
  updateNavLabels();
  renderGallery();
  renderMarquee();
  renderModalText();
  if (searchInput.value.trim()) runSearch(searchInput.value);
  revealToggle.textContent = siteRevealed ? toCipher("외계어") : "언어";
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
  const student = students[currentIndex];
  const work = getWork(currentIndex, currentType);

  galleryImage.src = work ? work.image : "images/placeholder.svg";
  galleryImage.alt = work ? work.title : "";
  galleryImage.style.transform = `rotate(${getRotate(work)}deg)`;
  viewerStudent.textContent = displayText(student ? student.student : "");
  counter.textContent = displayText(`${pad(currentIndex + 1)} / ${pad(students.length)}`);

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
  const speed = 56; // px per second, roughly matching the old 30s per loop
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
  currentIndex = Math.max(0, Math.min(students.length - 1, index));
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

// Moving between students is keyboard-only now (arrow keys) - dragging used
// to swipe between them, but that gesture is earmarked for the zoom dial
// instead, so the image area is just a click target for the detail modal.
function setupGalleryInteraction() {
  dragStage.addEventListener("click", () => {
    openModal(students[currentIndex]);
  });

  document.addEventListener("keydown", (e) => {
    if (views.gallery.hidden) return;
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
  });
}

// Weightless idle drift on the gallery image (see .gallery-float in
// style.css), which stops with a little startled wobble when the cursor
// lands on it and resumes drifting once the cursor leaves.
//
// The source PNGs are 1536x1024 canvases with a lot of transparent margin
// around the actual artwork, so "the cursor is over the image element"
// covers a much bigger area than "the cursor is over something visible" -
// reacting to the empty margin felt wrong. alphaHitTest reads the drawn
// image's pixels once per image load and looks up the alpha at the cursor's
// position, so hovering only counts where the artwork is actually opaque.
const alphaCanvas = document.createElement("canvas");
const alphaCtx = alphaCanvas.getContext("2d", { willReadFrequently: true });
let alphaData = null; // cached Uint8ClampedArray from getImageData, or null until ready

function buildAlphaMap() {
  alphaData = null;
  const w = galleryImage.naturalWidth;
  const h = galleryImage.naturalHeight;
  if (!w || !h) return;
  // Downscaled - this is only ever used for a coarse "is there art here"
  // lookup, not pixel-perfect hit testing, so a small canvas keeps every
  // mousemove lookup cheap.
  const scale = Math.min(1, 200 / Math.max(w, h));
  alphaCanvas.width = Math.max(1, Math.round(w * scale));
  alphaCanvas.height = Math.max(1, Math.round(h * scale));
  try {
    alphaCtx.clearRect(0, 0, alphaCanvas.width, alphaCanvas.height);
    alphaCtx.drawImage(galleryImage, 0, 0, alphaCanvas.width, alphaCanvas.height);
    alphaData = alphaCtx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height).data;
  } catch (err) {
    alphaData = null; // e.g. a tainted canvas - fall back to the full box
  }
}

// The element's own current rotation angle in degrees, read back from its
// computed transform matrix - used because the image can be rotated twice
// over (its own per-student tilt, nested inside the wrapper's animated
// drift), and getComputedStyle only ever reports one element's own matrix.
function getRotationDeg(el) {
  const value = getComputedStyle(el).transform;
  if (!value || value === "none") return 0;
  const m = new DOMMatrix(value);
  return Math.atan2(m.b, m.a) * (180 / Math.PI);
}

function isOverArtwork(clientX, clientY) {
  // offsetWidth/Height are the element's own layout box, unaffected by any
  // transform on it or its ancestors - since the <img> has no fixed
  // width/height (only max-width/max-height), this box already exactly
  // matches the rendered artwork, with no separate letterboxing to account
  // for.
  const renderW = galleryImage.offsetWidth;
  const renderH = galleryImage.offsetHeight;
  if (renderW <= 0 || renderH <= 0) return false;

  // getBoundingClientRect gives the on-screen (rotated) box, but its center
  // point is still exactly where the image's own center currently is,
  // regardless of rotation - rotating a box about its center never moves
  // the center.
  const rect = galleryImage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Un-rotate the cursor's offset from that center by the image's total
  // current rotation (its own per-student tilt plus whatever angle the
  // idle-drift animation is at right now on the wrapper), landing back in
  // the image's own unrotated pixel grid.
  const totalDeg = getRotationDeg(galleryFloat) + getRotationDeg(galleryImage);
  const rad = (-totalDeg * Math.PI) / 180;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad) + renderW / 2;
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad) + renderH / 2;

  if (localX < 0 || localY < 0 || localX > renderW || localY > renderH) return false;
  if (!alphaData) return true; // not ready yet - don't block the interaction

  const px = Math.min(alphaCanvas.width - 1, Math.floor((localX / renderW) * alphaCanvas.width));
  const py = Math.min(alphaCanvas.height - 1, Math.floor((localY / renderH) * alphaCanvas.height));
  const alpha = alphaData[(py * alphaCanvas.width + px) * 4 + 3];
  return alpha > 10;
}

function setupFloat() {
  let hovering = false;

  const startSettle = () => {
    galleryFloat.classList.remove("settled");
    if (!galleryFloat.classList.contains("settling")) {
      galleryFloat.classList.add("settling");
    }
  };

  const resumeDrift = () => {
    galleryFloat.classList.remove("settling", "settled");
  };

  const updateHover = (clientX, clientY) => {
    const over = isOverArtwork(clientX, clientY);
    if (over === hovering) return;
    hovering = over;
    if (hovering) startSettle();
    else resumeDrift();
  };

  dragStage.addEventListener("mousemove", (e) => updateHover(e.clientX, e.clientY));
  dragStage.addEventListener("mouseleave", () => {
    hovering = false;
    resumeDrift();
  });
  // Covers touch/pen input, which never fires mousemove before contact, so a
  // drag started without hovering first still stops the drift before it
  // moves the image.
  dragStage.addEventListener("pointerdown", startSettle);

  galleryImage.addEventListener("load", buildAlphaMap);
  if (galleryImage.complete) buildAlphaMap();

  galleryFloat.addEventListener("animationend", (e) => {
    if (e.animationName !== "float-settle") return;
    galleryFloat.classList.remove("settling");
    galleryFloat.classList.add("settled");
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
      showView("gallery");
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

function setupNav() {
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = el.dataset.view;
      // clicking the nav button for the view already showing returns to gallery
      showView(!views[target].hidden ? "gallery" : target);
    });
  });
  document.getElementById("info-close").addEventListener("click", () => showView("gallery"));
}

async function init() {
  const res = await fetch("data/works.json", { cache: "no-store" });
  students = await res.json();
  applyCipherStatic();
  searchInput.placeholder = displayText("Search");
  revealToggle.textContent = siteRevealed ? toCipher("외계어") : "언어";
  renderMarquee();
  renderGallery();
  setupGalleryInteraction();
  setupFloat();
  setupNav();
  setupModal();
  setupViewerTabs();
  setupSearch();
  setupRevealToggle();
  setupMarqueeAnimation();
  showView("gallery");
}

init();
