declare const __DEBUG__: boolean;

// px
const RADIUS = 4;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 200;
const COLOR = "yellow";
const TRANSPARENT = "#00000000";
const DEBUG = __DEBUG__;
// ms
const MIN_TIME = 32;
const MAX_TIME = 2000;

// ms: suppress the native context menu after a right-button cancel
const CONTEXT_MENU_SUPPRESS = 1000;

// mouse button codes
const BUTTON_LEFT = 0;
const BUTTON_RIGHT = 2;

// urls with these protocols are never opened
const IGNORED_PROTOCOLS = ["javascript:", "data:", "blob:", "about:", "mailto:", "tel:"];

let DPR = globalThis.devicePixelRatio || 1;
// radius px
let RADIUS_DPR = Math.round(RADIUS * DPR);

const HANDLE_OPTION = {
  capture: true,
  once: false,
  passive: false,
};

const DIV = document.createElement("div");

DIV.id = "__drag_open_tampermonkey__";
DIV.style.backgroundColor = TRANSPARENT;
DIV.style.backgroundSize = "contain";
DIV.style.backgroundRepeat = "no-repeat";
DIV.style.backgroundPosition = "center";
DIV.style.position = "fixed";
DIV.style.left = "0";
DIV.style.top = "0";
DIV.style.willChange = "transform";
DIV.style.zIndex = (2 ** 31 - 1).toString();
DIV.style.pointerEvents = "none";
DIV.style.userSelect = "none";
DIV.style.borderRadius = "50%";
DIV.style.display = "none";

let x1 = 0;
let y1 = 0;
let lastTime = 0;
let lastLink: string | undefined = undefined;
let timeoutHandle: ReturnType<typeof setTimeout> | undefined = undefined;
// timestamp until which the native context menu should be suppressed
let suppressContextMenuUntil = 0;
// restore flag for user-select disabling during a drag
let prevUserSelect: string | undefined = undefined;

function refreshDpr() {
  DPR = globalThis.devicePixelRatio || 1;
  RADIUS_DPR = Math.round(RADIUS * DPR);
  DIV.style.width = `${RADIUS_DPR * 2}px`;
  DIV.style.height = `${RADIUS_DPR * 2}px`;
}

refreshDpr();

function distance({ clientX, clientY }: MouseEvent) {
  return Math.hypot(x1 - clientX, y1 - clientY);
}

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log("[drag-open]", ...args);
  }
}
function clean() {
  if (timeoutHandle !== undefined) {
    clearTimeout(timeoutHandle);
    timeoutHandle = undefined;
  }
  lastTime = 0;
  lastLink = undefined;
  x1 = 0;
  y1 = 0;
  restoreUserSelect();
  hideDiv();
}

function preventUserSelect() {
  if (prevUserSelect !== undefined || !document.body) {
    return;
  }
  prevUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
}

function restoreUserSelect() {
  if (prevUserSelect === undefined || !document.body) {
    return;
  }
  document.body.style.userSelect = prevUserSelect;
  prevUserSelect = undefined;
}

function timeout() {
  const t = performance.now() - lastTime;
  return t > MAX_TIME;
}

function checkTime() {
  const t = performance.now() - lastTime;
  return t >= MIN_TIME && t <= MAX_TIME;
}
function checkArea(e: MouseEvent) {
  const d = distance(e);
  return d >= MIN_DISTANCE && d <= MAX_DISTANCE;
}

function check(e: MouseEvent) {
  return !!lastLink && checkTime() && checkArea(e);
}

function updateDiv(e: MouseEvent) {
  // Prevent it from being removed by other js code
  if (DIV.parentNode !== document.body) {
    document.body.appendChild(DIV);
  }

  const { clientX, clientY } = e;
  DIV.style.transform = `translate3d(${clientX - RADIUS_DPR}px, ${clientY - RADIUS_DPR}px, 0)`;
  DIV.style.backgroundColor = check(e) ? COLOR : TRANSPARENT;
  DIV.style.display = "flex";
}

function hideDiv() {
  DIV.style.display = "none";
}

function findClosestLink(element: Element | null) {
  // `closest` is case-insensitive, so it also matches SVG <a> elements
  return element?.closest("a") ?? null;
}

function getLink(el: Element | null) {
  const a = findClosestLink(el);
  if (!a) {
    log("getLink not found", el);
    return;
  }
  const href = (a.getAttribute("href") || "").trim();
  if (!href || href.startsWith("#")) {
    return;
  }
  if (IGNORED_PROTOCOLS.some((p) => href.toLowerCase().startsWith(p))) {
    log("getLink ignored protocol", href);
    return;
  }
  let fullUrl: string;
  try {
    fullUrl = new URL(href, globalThis.location.href).href;
  } catch {
    log("getLink invalid url", href);
    return;
  }
  log("getLink", a, fullUrl);
  return fullUrl;
}

function mousedown(e: MouseEvent) {
  log("mousedown", e, check(e));
  // Right button cancels an in-progress drag
  if (e.button === BUTTON_RIGHT) {
    if (lastLink) {
      log("cancel by right button");
      suppressContextMenuUntil = performance.now() + CONTEXT_MENU_SUPPRESS;
      stopEvent(e);
      clean();
    }
    return;
  }
  // Only the left button can start a drag
  if (e.button !== BUTTON_LEFT || lastLink) {
    return;
  }
  x1 = e.clientX;
  y1 = e.clientY;
  lastTime = performance.now();
  lastLink = getLink(e.target as Element);

  if (lastLink) {
    preventUserSelect();
    clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      log("timeout clean");
      clean();
    }, MAX_TIME);
  }
}

function stopEvent(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
  e.stopImmediatePropagation();
}
function mouseup(e: MouseEvent) {
  log("mouseup", e, check(e));
  // Right button is handled by mousedown/contextmenu
  if (e.button === BUTTON_RIGHT) {
    return;
  }
  if (!lastLink || !check(e)) {
    clean();
    return;
  }
  // A successful drag is normally opened by `drop`; this covers pages that do
  // not fire a native drop. `clean()` clears `lastLink`, so the two paths never
  // open the same link twice.
  GM_openInTab(lastLink, { active: e.shiftKey });
  stopEvent(e);
  clean();
}

function drop(e: MouseEvent) {
  log("drop", e, check(e));
  if (!lastLink || !check(e)) {
    clean();
    return;
  }
  GM_openInTab(lastLink, { active: e.shiftKey });
  stopEvent(e);
  clean();
}

function dragover(e: MouseEvent) {
  log("dragover", e, check(e));
  if (!lastLink || timeout()) {
    clean();
    return;
  }
  updateDiv(e);
  stopEvent(e);
  return true;
}

function mousemove(e: MouseEvent) {
  if (!lastLink || timeout()) {
    clean();
    return;
  }
  log("mousemove", check(e));
  updateDiv(e);
}

function contextmenu(e: MouseEvent) {
  log("contextmenu", e, !!lastLink);
  const suppressed = performance.now() <= suppressContextMenuUntil;
  if (!lastLink && !suppressed) {
    return;
  }
  suppressContextMenuUntil = 0;
  stopEvent(e);
  clean();
}

function dragend(e: DragEvent) {
  log("dragend", e);
  clean();
}

function keydown(e: KeyboardEvent) {
  if (e.key === "Escape" && lastLink) {
    log("cancel by escape");
    clean();
  }
}

const BIND_MAP = [
  ["mousedown", mousedown],
  ["mousemove", mousemove],
  ["dragover", dragover],
  ["mouseup", mouseup],
  ["drop", drop],
  ["dragend", dragend],
  ["contextmenu", contextmenu],
  ["keydown", keydown],
] as const;

function init() {
  log("init");
  refreshDpr();
  globalThis.addEventListener("resize", refreshDpr);
  for (const [key, fn] of BIND_MAP) {
    document.removeEventListener(key, fn as EventListener, HANDLE_OPTION);
    document.addEventListener(key, fn as EventListener, HANDLE_OPTION);
  }
}

init();
