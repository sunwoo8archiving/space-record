let students = [];
let currentIndex = 0;
let currentType = "spaceship";
let lensTiltDeg = 0; // current work's per-student rotate() from works.json
let currentLensSrc = null; // last image src loaded into the lens, so renderGallery() only resets zoom/pan when the artwork actually changes

const galleryImage = document.getElementById("gallery-image");
const viewerStudent = document.getElementById("viewer-student");
const viewerTabs = document.getElementById("viewer-tabs");
const viewerMarquee = document.getElementById("viewer-marquee");
const viewerMarqueeTrack = document.getElementById("viewer-marquee-track");
const counter = document.getElementById("counter");
const dragStage = document.getElementById("drag-stage");
const lensWrap = document.getElementById("lens-wrap");
const galleryImageHalo = document.getElementById("gallery-image-halo");
const ticksWrap = document.getElementById("ticks");
const indicator = document.getElementById("indicator");
const porthole = document.getElementById("porthole");
const gripHit = document.getElementById("grip-hit");
const dustBackCanvas = document.getElementById("dust-back");
const dustFrontCanvas = document.getElementById("dust-front");
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

  const src = work ? work.image : "images/placeholder.svg";
  // renderGallery() also re-runs for things that don't change the artwork
  // itself (toggling the cipher/reveal text, a window resize) - only reset
  // the dial's zoom/pan when the image actually changes underneath it, or
  // toggling "언어" mid-zoom would yank it back to 1x for no reason.
  if (src !== currentLensSrc) {
    currentLensSrc = src;
    galleryImage.src = src;
    galleryImageHalo.src = src; // kept in sync for the glass halo (see setupLensDial)
    lensTiltDeg = getRotate(work);
    resetLens();
  }
  galleryImage.alt = work ? work.title : "";
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
  // Wraps instead of clamping, so ArrowRight/ArrowLeft can cross 19 <-> 01.
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

// Moving between students is keyboard-only now (arrow keys) - dragging used
// to swipe between them, but that gesture is earmarked for the zoom dial
// instead, so the image area is just a click target for the detail modal.
// Clicking to open the detail modal now happens on the lens glass itself
// (see setupLensDial's pan handler, which opens it on an undragged click).
function setupGalleryInteraction() {
  document.addEventListener("keydown", (e) => {
    if (views.gallery.hidden) return;
    if (e.key === "ArrowRight") goTo(currentIndex + 1);
    if (e.key === "ArrowLeft") goTo(currentIndex - 1);
  });
}

// --- Lens dial: drag the ring to zoom (with click-stops), drag the glass
// to pan, both clamped, with a glass halo and drifting dust for texture.
// See the standalone prototype this was developed against for the design
// notes; this is that same logic wired into the real gallery state.
const DETENT_DEG = 20;
const STOPS_PER_REV = 360 / DETENT_DEG; // 18 major stops
const SUBTICKS_PER_GAP = 3;
const FINE_PER_MAJOR = SUBTICKS_PER_GAP + 1; // 4
const FINE_DEG = DETENT_DEG / FINE_PER_MAJOR; // 5deg
const TOTAL_FINE = STOPS_PER_REV * FINE_PER_MAJOR; // 72
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.6;
const ZOOM_PER_FINE = (MAX_ZOOM - MIN_ZOOM) / TOTAL_FINE; // one full turn = the whole range
// Below this angular speed (deg/ms), turning is slow/deliberate enough to
// click through the minor ticks too; at or above it, only the major stops
// register, so a fast spin coasts smoothly past the fine steps instead of
// stuttering through all 72 of them.
const FINE_SPEED_THRESHOLD = 0.1;

let lensTotalDeg = 0;
let lensLastDetent = 0;
let lensPanX = 0;
let lensPanY = 0;
let lensTargetZoom = MIN_ZOOM;
let lensDisplayedZoom = MIN_ZOOM;
let lensTargetBlur = 0;
let lensDisplayedBlur = 0;
let lensBlurTimer = null;
const allTicks = []; // index 0..71 (fine units), one entry per tick mark

function buildLensTicks() {
  for (let i = 0; i < STOPS_PER_REV; i++) {
    const slot = document.createElement("div");
    slot.className = "tick-slot";
    slot.style.transform = `rotate(${i * DETENT_DEG}deg)`;
    const tick = document.createElement("div");
    tick.className = "tick stop";
    slot.appendChild(tick);
    ticksWrap.appendChild(slot);
    allTicks[i * FINE_PER_MAJOR] = tick;

    for (let k = 1; k < FINE_PER_MAJOR; k++) {
      const subSlot = document.createElement("div");
      subSlot.className = "tick-slot";
      subSlot.style.transform = `rotate(${i * DETENT_DEG + k * FINE_DEG}deg)`;
      const sub = document.createElement("div");
      sub.className = "tick";
      subSlot.appendChild(sub);
      ticksWrap.appendChild(subSlot);
      allTicks[i * FINE_PER_MAJOR + k] = sub;
    }
  }
}

function flashLensTick(fineIndex) {
  const i = ((fineIndex % TOTAL_FINE) + TOTAL_FINE) % TOTAL_FINE;
  const el = allTicks[i];
  el.classList.add("active");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("active"), 220);
}

// TODO(sound): call a short "click" sample here once audio is wired up.
function playDetentClick() {}

// Resets the dial to its resting state whenever the artwork underneath it
// changes (new student, new type) - zoom/pan on one piece shouldn't carry
// over onto the next.
function resetLens() {
  lensTotalDeg = 0;
  lensLastDetent = 0;
  lensPanX = 0;
  lensPanY = 0;
  lensTargetZoom = MIN_ZOOM;
  lensDisplayedZoom = MIN_ZOOM;
  lensTargetBlur = 0;
  lensDisplayedBlur = 0;
  if (indicator) indicator.style.transform = "rotate(0deg)";
}

function setupLensDial() {
  buildLensTicks();

  // Paint the reset state (from the renderGallery() call that already ran
  // during init) once synchronously, so the image doesn't flash at its
  // untransformed top/left:50% position for a frame before the render
  // loop below gets to it.
  const initialTransform = `translate(-50%, -50%) rotate(${lensTiltDeg}deg) scale(${lensDisplayedZoom})`;
  galleryImage.style.transform = initialTransform;
  galleryImageHalo.style.transform = initialTransform;

  let ringDragging = false;
  let ringLastAngle = 0;
  let ringLastMoveTime = 0;

  function angleAt(clientX, clientY) {
    const rect = lensWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }
  function shortestDelta(from, to) {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
  function scheduleRefocus() {
    clearTimeout(lensBlurTimer);
    lensBlurTimer = setTimeout(() => {
      lensTargetBlur = 0;
    }, 100);
  }

  function onRingDown(e) {
    ringDragging = true;
    try {
      gripHit.setPointerCapture(e.pointerId);
    } catch (err) {}
    ringLastAngle = angleAt(e.clientX, e.clientY);
    ringLastMoveTime = performance.now();
  }
  function onRingMove(e) {
    if (!ringDragging) return;
    const now = performance.now();
    const angle = angleAt(e.clientX, e.clientY);
    const delta = shortestDelta(ringLastAngle, angle);
    const dt = Math.max(1, now - ringLastMoveTime);
    const speed = Math.abs(delta) / dt;

    lensTotalDeg = Math.min(360, Math.max(0, lensTotalDeg + delta)); // hard stop: one full turn

    const fineDetent = Math.round(lensTotalDeg / FINE_DEG);
    const effectiveDetent =
      speed < FINE_SPEED_THRESHOLD ? fineDetent : Math.round(fineDetent / FINE_PER_MAJOR) * FINE_PER_MAJOR;

    if (effectiveDetent !== lensLastDetent) {
      lensLastDetent = effectiveDetent;
      indicator.style.transform = `rotate(${effectiveDetent * FINE_DEG}deg)`;
      lensTargetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, MIN_ZOOM + effectiveDetent * ZOOM_PER_FINE));
      flashLensTick(effectiveDetent);
      playDetentClick();
    }

    lensTargetBlur = Math.min(6, speed * 90);
    scheduleRefocus();

    ringLastAngle = angle;
    ringLastMoveTime = now;
  }
  function onRingUp(e) {
    if (!ringDragging) return;
    ringDragging = false;
    try {
      gripHit.releasePointerCapture(e.pointerId);
    } catch (err) {}
    scheduleRefocus();
  }

  gripHit.addEventListener("pointerdown", onRingDown);
  gripHit.addEventListener("pointermove", onRingMove);
  gripHit.addEventListener("pointerup", onRingUp);
  gripHit.addEventListener("pointercancel", onRingUp);

  // --- pan (drag the glass itself, independent of the ring) ------------
  let panDragging = false;
  let panStartX = 0;
  let panStartY = 0;
  let panBaseX = 0;
  let panBaseY = 0;
  let panMoved = false;
  const clickThreshold = 6;

  function maxPanFor(zoom) {
    const size = porthole.clientWidth || lensWrap.clientWidth;
    const rendered = size * 1.32 * zoom;
    return Math.max(0, (rendered - size) / 2);
  }

  function onPanDown(e) {
    e.preventDefault();
    panDragging = true;
    panMoved = false;
    porthole.classList.add("panning");
    try {
      porthole.setPointerCapture(e.pointerId);
    } catch (err) {}
    panStartX = e.clientX;
    panStartY = e.clientY;
    panBaseX = lensPanX;
    panBaseY = lensPanY;
  }
  function onPanMove(e) {
    if (!panDragging) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    if (Math.abs(dx) > clickThreshold || Math.abs(dy) > clickThreshold) panMoved = true;
    const limit = maxPanFor(lensDisplayedZoom);
    lensPanX = Math.min(limit, Math.max(-limit, panBaseX + dx));
    lensPanY = Math.min(limit, Math.max(-limit, panBaseY + dy));
  }
  function onPanUp(e) {
    if (!panDragging) return;
    panDragging = false;
    porthole.classList.remove("panning");
    try {
      porthole.releasePointerCapture(e.pointerId);
    } catch (err) {}
    if (!panMoved) openModal(students[currentIndex]);
  }

  porthole.addEventListener("pointerdown", onPanDown);
  porthole.addEventListener("pointermove", onPanMove);
  porthole.addEventListener("pointerup", onPanUp);
  porthole.addEventListener("pointercancel", onPanUp);
  // Same fix as the rest of the gallery's drag surfaces - without this,
  // dragging across the image starts a native text/image selection.
  document.addEventListener("selectstart", (e) => {
    if (panDragging) e.preventDefault();
  });

  function renderLoop() {
    lensDisplayedZoom += (lensTargetZoom - lensDisplayedZoom) * 0.18;
    lensDisplayedBlur += (lensTargetBlur - lensDisplayedBlur) * 0.25;
    if (Math.abs(lensTargetBlur - lensDisplayedBlur) < 0.03) lensDisplayedBlur = lensTargetBlur;

    const limit = maxPanFor(lensDisplayedZoom);
    lensPanX = Math.min(limit, Math.max(-limit, lensPanX));
    lensPanY = Math.min(limit, Math.max(-limit, lensPanY));

    const t = `translate(calc(-50% + ${lensPanX.toFixed(1)}px), calc(-50% + ${lensPanY.toFixed(1)}px)) rotate(${lensTiltDeg}deg) scale(${lensDisplayedZoom.toFixed(4)})`;
    galleryImage.style.transform = t;
    galleryImageHalo.style.transform = t;
    galleryImage.style.filter = lensDisplayedBlur > 0.03 ? `blur(${lensDisplayedBlur.toFixed(2)}px)` : "none";
    porthole.classList.toggle("focusing", lensDisplayedBlur > 0.2);

    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  setupDustLayers();
}

// Two independent particle layers - one painted before #gallery-image in
// the DOM (so it sits behind it), one after (in front) - so the dust reads
// as floating in space around the specimen instead of one flat sheet stuck
// on top of the image. Fully code-generated (soft radial gradients, slow
// random drift, a gentle per-particle twinkle) - no image or video asset
// needed.
function makeDustLayer(canvasEl, count) {
  const ctx = canvasEl.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let size = 0;
  let particles = [];

  function resize() {
    const rect = porthole.getBoundingClientRect();
    size = Math.max(1, Math.round(rect.width));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvasEl.width = size * dpr;
    canvasEl.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParticles(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const warm = Math.random() < 0.3;
      arr.push({
        x: Math.random() * size,
        y: Math.random() * size,
        r: 0.8 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        baseAlpha: 0.28 + Math.random() * 0.38,
        phase: Math.random() * Math.PI * 2,
        freq: 0.4 + Math.random() * 0.5,
        color: warm ? "216,168,110" : "255,255,255",
      });
    }
    return arr;
  }

  function stepParticle(p, tSec) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -8) p.x = size + 8;
    if (p.x > size + 8) p.x = -8;
    if (p.y < -8) p.y = size + 8;
    if (p.y > size + 8) p.y = -8;
    return p.baseAlpha * (0.65 + 0.35 * Math.sin(tSec * p.freq + p.phase));
  }

  function draw(tSec) {
    ctx.clearRect(0, 0, size, size);
    for (const p of particles) {
      const alpha = reduceMotion ? p.baseAlpha : stepParticle(p, tSec);

      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
      halo.addColorStop(0, `rgba(30,28,24,${(alpha * 0.18).toFixed(3)})`);
      halo.addColorStop(1, "rgba(30,28,24,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      core.addColorStop(0, `rgba(${p.color},${alpha.toFixed(3)})`);
      core.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(ts) {
    draw(ts / 1000);
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  function init() {
    resize();
    particles = makeParticles(count);
    draw(0);
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  return { init };
}

function setupDustLayers() {
  const dustBackLayer = makeDustLayer(dustBackCanvas, 26);
  const dustFrontLayer = makeDustLayer(dustFrontCanvas, 34);

  function initDust() {
    dustBackLayer.init();
    dustFrontLayer.init();
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initDust, 200);
  });

  initDust();
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
  setupLensDial();
  setupNav();
  setupModal();
  setupViewerTabs();
  setupSearch();
  setupRevealToggle();
  setupMarqueeAnimation();
  showView("gallery");
}

init();
