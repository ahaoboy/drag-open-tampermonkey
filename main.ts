// px
const MIN_DISTANCE = 6
const MAX_DISTANCE = 200
// ms
const MIN_TIME = 32
const MAX_TIME = 2000

let x1 = 0
let y1 = 0
let lastTime = 0
let lastLink: string | undefined = undefined;

function distance({ x, y }: { x: number, y: number }) {
  return (((x1 - x) ** 2) + ((y1 - y) ** 2)) ** 0.5
}

function clean() {
  lastTime = 0
  lastLink = undefined
  x1 = 0
  y1 = 0
}

function check(e: MouseEvent) {
  if (!lastLink) {
    return
  }
  const d = distance(e)

  if (d < MIN_DISTANCE || d > MAX_DISTANCE) {
    return
  }
  const t = performance.now() - lastTime
  if (t < MIN_TIME || t > MAX_TIME) {
    return
  }
  return true
}

function findClosestLink(element: HTMLElement | null) {
  while (element && element.tagName !== 'A') {
    element = element.parentElement;
  }
  return element;
}

function getLink(el: HTMLElement) {
  const a = findClosestLink(el)
  if (!a) {
    return
  }
  const fullUrl = new URL(a.getAttribute("href") || "", window.location.href).href;
  return fullUrl
}

document.addEventListener("mousedown", e => {
  x1 = e.x
  y1 = e.y
  lastTime = performance.now()
  lastLink = getLink(e.target as HTMLElement)
})

document.addEventListener('mouseup', (e) => {
  if (!check(e)) {
    return
  }
  e.stopPropagation()
  if (lastLink) {
    GM_openInTab(lastLink, { active: e.shiftKey });
  } clean()
})

document.addEventListener('drop', (e) => {
  if (!check(e)) {
    return
  }
  if (lastLink) {
    GM_openInTab(lastLink, { active: e.shiftKey });
  }
  clean()
})

document.addEventListener('dragover', (e) => {
  if (!lastLink) {
    return
  }
  e.preventDefault();
  return true
})

