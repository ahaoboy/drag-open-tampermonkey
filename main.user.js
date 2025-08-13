// ==UserScript==
// @name         drag-open-tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  drag the link to open a new tab
// @author       ahaoboy
// @match        *://*/*
// @grant        GM_openInTab
// @run-at       document-end
// @homepage     https://github.com/ahaoboy/drag-open-tampermonkey.git
// @downloadURL  https://github.com/ahaoboy/drag-open-tampermonkey/raw/refs/heads/main/main.user.js
// ==/UserScript==

const DRAG_DISTANCE = 10
const DRAG_TIME = 100
const OVER_TIME = 1000

let x1 = 0
let y1 = 0
let lastTime = 0
let lastLink = undefined;

function distance({ x, y }) {
  return (((x1 - x) ** 2) + ((y1 - y) ** 2)) ** 0.5
}

function clean() {
  lastTime = 0
  lastLink = undefined
  x1 = 0
  y1 = 0
}

function check(e) {
  if (!lastLink) {
    return
  }
  const d = distance(e)

  if (d < DRAG_DISTANCE) {
    return
  }
  const t = performance.now() - lastTime
  if (t < DRAG_TIME || t > OVER_TIME) {
    return
  }
  return true
}

function findClosestLink(element) {
  while (element && element.tagName !== 'A') {
    element = element.parentElement;
  }
  return element;
}

function getLink(el) {
  const a = findClosestLink(el)
  if (!a) {
    return
  }
  const fullUrl = new URL(a.getAttribute("href"), window.location.href).href;
  return fullUrl
}

document.addEventListener("mousedown", e => {
  x1 = e.x
  y1 = e.y
  lastTime = performance.now()
  lastLink = getLink(e.target)
})

document.addEventListener('mouseup', (e) => {
  if (!check(e)) {
    return
  }
  e.stopPropagation()
  GM_openInTab(lastLink, { active: e.shiftKey });
  clean()
})

document.addEventListener('drop', (e) => {
  if (!check(e)) {
    return
  }
  GM_openInTab(lastLink, { active: e.shiftKey });
  clean()
})

document.addEventListener('dragover', (e) => {
  if (!lastLink) {
    return
  }
  e.preventDefault();
  return true
})

