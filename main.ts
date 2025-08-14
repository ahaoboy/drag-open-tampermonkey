// px
const RADIUS = 4;
const MIN_DISTANCE = 6;
const MAX_DISTANCE = 200;
const COLOR = "yellow";
const TRANSPARENT = "#00000000";
const DEBUG = false;
// ms
const MIN_TIME = 32;
const MAX_TIME = 2000;

const DPR = globalThis.devicePixelRatio || 1;
// radius px
const RADIUS_DPR = (RADIUS * DPR) | 0;

const HANDLE_OPTION = {
  capture: true,
  once: false,
  passive: false,
};
// const HANDLE_OPTION = undefined;

const DIV = document.createElement("div");

DIV.id = "__drag_open_tampermonkey__";
DIV.style.backgroundColor = TRANSPARENT;
DIV.style.backgroundSize = "contain";
DIV.style.backgroundRepeat = "no-repeat";
DIV.style.backgroundPosition = "center";
DIV.style.width = `${RADIUS_DPR * 2}px`;
DIV.style.height = `${RADIUS_DPR * 2}px`;
DIV.style.position = "absolute";
DIV.style.left = "0";
DIV.style.top = "0";
DIV.style.zIndex = (2 ** 31 - 1).toString();
DIV.style.pointerEvents = "none";
DIV.style.userSelect = "none";
DIV.style.borderRadius = "50%";
let x1 = 0;
let y1 = 0;
let lastTime = 0;
let lastLink: string | undefined = undefined;
let timeoutHandle = 0

function distance({ pageX, pageY }: MouseEvent) {
  return (((x1 - pageX) ** 2) + ((y1 - pageY) ** 2)) ** 0.5;
}

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log("[drag-open]", ...args);
  }
}
function clean() {
  lastTime = 0;
  lastLink = undefined;
  x1 = 0;
  y1 = 0;
  hideDiv();
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
  document.body.appendChild(DIV);

  const { pageX, pageY } = e;
  DIV.style.left = `${pageX - RADIUS_DPR}px`;
  DIV.style.top = `${pageY - RADIUS_DPR}px`;
  const url = check(e) ? COLOR : TRANSPARENT;
  DIV.style.backgroundColor = url;
  DIV.style.display = "flex";
}

function hideDiv() {
  DIV.style.display = "none";
}

function findClosestLink(element: HTMLElement | null) {
  while (element && element.tagName !== "A") {
    element = element.parentElement;
  }
  return element;
}

function getLink(el: HTMLElement) {
  const a = findClosestLink(el);
  if (!a) {
    return;
  }
  const href = a.getAttribute("href") || "";
  const fullUrl = href.includes("://")
    ? href
    : new URL(href, globalThis.location.href).href;
  log("getLink", a, fullUrl);
  return fullUrl;
}

function mousedown(e: MouseEvent) {
  log("mousedown", e, check(e));
  if (lastLink) {
    return;
  }
  x1 = e.pageX;
  y1 = e.pageY;
  lastTime = performance.now();
  lastLink = getLink(e.target as HTMLElement);

  clearTimeout(timeoutHandle)
  timeoutHandle = 0
  timeoutHandle = +setTimeout(() => {
    log("timeout clean")
    clean()
  }, MAX_TIME);
}

function stopEvent(e: MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
  e.stopImmediatePropagation();
}
function mouseup(e: MouseEvent) {
  log("mouseup", e, check(e));
  if (!lastLink || !check(e)) {
    clean();
    return;
  }
  // FIXME: Prevent opening a new tab and clicking on the video
  stopEvent(e);
  // GM_openInTab(lastLink, { active: e.shiftKey });
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
  log("mousemove", e, check(e));
  updateDiv(e);
}

const BIND_MAP = [
  ["mousedown", mousedown],
  // ["click", mousedown],
  ["mousemove", mousemove],
  ["dragover", dragover],
  ["mouseup", mouseup],
  ["drop", drop],
] as const;

function init() {
  log("init");
  for (const [key, fn] of BIND_MAP) {
    document.removeEventListener(key, fn, HANDLE_OPTION);
    document.addEventListener(key, fn, HANDLE_OPTION);
  }
}

init();
