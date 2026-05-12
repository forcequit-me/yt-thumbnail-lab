const ROOT_CLASS = "ytlab-active";
const SIM_ATTR = "data-ytlab-sim";

const SIM_FALLBACKS = {
  title: "Your title goes here",
  channel: "Your Channel",
};

function normalizeSim(sim) {
  if (!sim) return sim;
  return {
    ...sim,
    title: sim.title || SIM_FALLBACKS.title,
    channel: sim.channel || SIM_FALLBACKS.channel,
  };
}

let currentState = { active: false, sim: { enabled: false } };
let observer = null;
let pending = null;
let hasFetchedState = false;
let navGeneration = 0;
let scopedTimers = new Set();

function getRouteKey() {
  return `${location.pathname}${location.search}`;
}

function getRoutePage() {
  const p = location.pathname;
  if (p === "/" || p.startsWith("/feed")) return "home";
  if (p === "/results") return "search";
  if (p === "/watch") return "watch";
  return null;
}

let lastRouteKey = getRouteKey();

function nextGeneration() {
  navGeneration += 1;
}

function setScopedTimeout(fn, delay) {
  const generation = navGeneration;
  const id = setTimeout(() => {
    scopedTimers.delete(id);
    if (generation !== navGeneration) return;
    fn();
  }, delay);
  scopedTimers.add(id);
  return id;
}

function clearScopedTimers() {
  scopedTimers.forEach((id) => clearTimeout(id));
  scopedTimers.clear();
  pending = null;
}

function applyGrayscale(active) {
  const root = document.documentElement;
  if (!root) return;
  if (active) root.classList.add(ROOT_CLASS);
  else root.classList.remove(ROOT_CLASS);
}

function removeInjected() {
  document.querySelectorAll(`[${SIM_ATTR}]`).forEach((n) => n.remove());
}

function existingSimLooksValid(node) {
  if (!node || !hasRenderableBox(node)) return false;
  if (location.pathname !== "/watch") return true;
  const scope = findWatchSidebarScope();
  return !!scope && scope.contains(node);
}

function findByAncestorItem(itemTag) {
  const items = Array.from(
    document.querySelectorAll(`${itemTag}:not([${SIM_ATTR}])`)
  );
  if (items.length === 0) return null;
  return { itemTag, items };
}

function findSearchVideos() {
  const sections = document.querySelectorAll(
    "ytd-item-section-renderer[page-subtype='search'] > #contents"
  );
  for (const container of sections) {
    const items = Array.from(container.children).filter(
      (c) => c.tagName === "YTD-VIDEO-RENDERER" && !c.hasAttribute(SIM_ATTR)
    );
    if (items.length > 0) return { itemTag: "ytd-video-renderer", items };
  }
  const first = document.querySelector(
    `ytd-video-renderer:not([${SIM_ATTR}])`
  );
  if (!first) return null;
  const parent = first.parentElement;
  if (!parent) return null;
  const items = Array.from(parent.children).filter(
    (c) => c.tagName === "YTD-VIDEO-RENDERER" && !c.hasAttribute(SIM_ATTR)
  );
  if (items.length === 0) return null;
  return { itemTag: "ytd-video-renderer", items };
}

function findHomeItems() {
  const all = Array.from(
    document.querySelectorAll(`ytd-rich-item-renderer:not([${SIM_ATTR}])`)
  );
  if (all.length === 0) return null;
  const noShorts = all.filter((el) => !hasShortsSignal(el));
  if (noShorts.length === 0) return null;
  return { itemTag: "ytd-rich-item-renderer", items: noShorts };
}

function isAd(el) {
  if (!el) return false;
  return !!(
    el.querySelector("ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-action-companion-ad-renderer, [is-ad], ad-slot-renderer") ||
    el.hasAttribute("is-ad") ||
    el.querySelector("[aria-label='Sponsored']")
  );
}

function hasCardTitle(el) {
  if (!el) return false;
  const titleEl = el.querySelector(".ytLockupMetadataViewModelTitle, a#video-title, h3 a");
  const titleText = (titleEl || el).textContent || "";
  return titleText.trim().length >= 2;
}

// Shared anchor-position filter. injectOnce and handleNudge MUST use the same
// list, else handleNudge sets a pinnedAnchor id that injectOnce can't find →
// inject falls back to viewport center → sim looks "locked".
// Looser than template-eligibility (no thumbnail-ready gate) so positions
// stay stable while images lazy-load.
function getAnchorablePositionItems(target) {
  return target.items.filter((el) => {
    if (isAd(el)) return false;
    if (!hasCardTitle(el)) return false;
    if (target.page === "search") {
      if (hasShortsSignal(el)) return false;
      return true;
    }
    if (target.page === "home" && hasShortsSignal(el)) return false;
    return true;
  });
}

// Stable identifier for a video card. Survives DOM re-renders that replace
// the element instance — we re-find the card by what's inside it, not by
// pointer. href is the strongest signal; title is a tiebreaker for cards
// without /watch URLs (lockup view models, etc.).
function cardId(el) {
  if (!el) return null;
  const link = el.querySelector(
    "a[href*='/watch'], a[href*='/shorts/'], a.yt-lockup-view-model-wiz__content-image"
  );
  const href = link ? link.getAttribute("href") || "" : "";
  const titleEl = el.querySelector(
    ".ytLockupMetadataViewModelTitle, a#video-title, #video-title, h3 a"
  );
  const title = (titleEl && titleEl.textContent ? titleEl.textContent : "").trim().slice(0, 64);
  if (!href && !title) return null;
  return `${href}|${title}`;
}

function findItemsInScope(scope, itemTag) {
  const items = Array.from(
    scope.querySelectorAll(`${itemTag}:not([${SIM_ATTR}])`)
  ).filter(hasRenderableBox);
  if (items.length === 0) return null;
  return { itemTag, items };
}

function hasRenderableBox(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findWatchSidebarScope() {
  const candidates = [
    document.querySelector("#secondary ytd-watch-next-secondary-results-renderer"),
    document.querySelector("ytd-watch-next-secondary-results-renderer"),
    document.querySelector("#secondary #related"),
    document.querySelector("#related"),
    document.querySelector("#secondary"),
  ];
  return candidates.find((el) => el && hasRenderableBox(el)) || null;
}

function findContainerAndTemplate() {
  const path = location.pathname;
  if (path === "/" || path.startsWith("/feed")) {
    const t = findHomeItems();
    if (t) t.page = "home";
    return t;
  }
  if (path === "/results") {
    const t = findSearchVideos();
    if (t) t.page = "search";
    return t;
  }
  if (path === "/watch") {
    const scope = findWatchSidebarScope();
    if (!scope) return null;

    const itemTypes = [
      "ytd-compact-video-renderer",
      "yt-lockup-view-model",
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
    ];

    for (const tag of itemTypes) {
      const result = findItemsInScope(scope, tag);
      if (result) { result.page = "watch"; return result; }
    }

    const sections = scope.querySelectorAll("ytd-item-section-renderer #contents");
    for (const section of sections) {
      for (const tag of itemTypes) {
        const result = findItemsInScope(section, tag);
        if (result) { result.page = "watch"; return result; }
      }
    }

    return null;
  }
  return null;
}

// Anchor-pinning model: track which real card the sim should sit before by
// stable identifier (href + title), not DOM pointer. Pointers break when
// YouTube re-renders; cardId() survives because we re-find the card each time.
// Mode:
//   "top"      — snap to top index for that page (idx 0 on search since
//                main results section can start far below the header; idx 2
//                on home/watch where lists are dense and idx 2 is "near top")
//   "viewport" — snap to viewport center
//   "el"       — use pinnedAnchor[page] string ID
function topIndexFor(page) {
  // search: idx 0 — first section can have only 1 video before a shelf
  //         interrupts. idx 1 would push sim past that into the next section,
  //         which is visually past the shelf gap.
  // home/watch: 3rd slot, what users said felt right on those pages.
  return page === "search" ? 0 : 2;
}
function defaultModeFor() {
  return "top";
}
let pinnedAnchor = { home: null, search: null, watch: null };
let pinnedAnchorMode = {
  home: defaultModeFor(),
  search: defaultModeFor(),
  watch: defaultModeFor(),
};

function getViewportCenterIndex(items) {
  const vCenter = window.innerHeight / 2;
  let closestIdx = 0;
  let minDiff = Infinity;
  items.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return;
    const elCenter = rect.top + rect.height / 2;
    const diff = Math.abs(elCenter - vCenter);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  });
  return closestIdx;
}

function resolveAnchorIndex(items, page) {
  const len = items.length;
  if (len === 0) return 0;
  const mode = pinnedAnchorMode[page];
  if (mode === "top") return Math.min(topIndexFor(page), len - 1);
  if (mode === "el") {
    const id = pinnedAnchor[page];
    if (id) {
      const idx = items.findIndex((el) => cardId(el) === id);
      if (idx >= 0) return idx;
    }
  }
  return getViewportCenterIndex(items);
}

function neutralizeLinks(node) {
  node.querySelectorAll("a").forEach((a) => {
    a.setAttribute("href", "#ytlab-sim");
    a.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
  });
}

const AVATAR_SELECTOR =
  "[data-ytlab-avatar-root], [data-ytlab-avatar-visual], #avatar, #channel-thumbnail, ytd-channel-avatar, yt-avatar-shape, .yt-avatar-shape, #avatar-container, yt-img-shadow";

// Outer avatar containers — used to capture/lock size before freezeLitElements
// strips tag-targeted CSS. Includes a#avatar-link (search variant).
const AVATAR_CONTAINER_SEL =
  "[data-ytlab-avatar-root], #avatar, #channel-thumbnail, ytd-channel-avatar, yt-avatar-shape, .yt-avatar-shape, #avatar-container, yt-img-shadow, a#avatar-link";

const AVATAR_VISUAL_SEL =
  "yt-avatar-shape, .yt-avatar-shape, yt-img-shadow, #avatar";

function avatarCandidateScore(el) {
  let score = 0;
  if (el.hasAttribute("data-ytlab-avatar-root")) score = 1000;
  else if (el.matches("a#channel-thumbnail")) score = 900;
  else if (el.matches("ytd-channel-avatar")) score = 850;
  else if (el.matches("a#avatar-link")) score = 800;
  else if (el.matches("yt-avatar-shape, .yt-avatar-shape")) score = 700;
  else if (el.matches("#avatar-container")) score = 650;
  else if (el.matches("#avatar")) score = 600;
  else if (el.matches("yt-img-shadow")) score = 500;
  if (score && el.querySelector("img")) score += 50;
  if (el.closest("ytd-thumbnail, yt-thumbnail-view-model, [data-ytlab-thumb]")) score -= 1000;
  return score;
}

function avatarCandidates(root) {
  return Array.from(root.querySelectorAll(AVATAR_CONTAINER_SEL))
    .map((el, index) => ({ el, index, score: avatarCandidateScore(el) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.el);
}

function findAvatarTarget(root) {
  return avatarCandidates(root)[0] || null;
}

function readPx(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function measureBox(el) {
  if (!el) return { width: 0, height: 0 };
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return {
    width: rect.width || readPx(cs.width),
    height: rect.height || readPx(cs.height),
  };
}

function defaultAvatarVisualSize(target) {
  if (location.pathname === "/results" && target && target.matches("a#channel-thumbnail, a#avatar-link")) {
    return 24;
  }
  return 36;
}

function normalizeAvatarVisualSize(size, fallback) {
  if (!Number.isFinite(size) || size < 8) return fallback;
  return Math.max(16, Math.min(36, Math.round(size)));
}

function normalizeAvatarBoxSize(size, fallback) {
  if (!Number.isFinite(size) || size < 8) return fallback;
  return Math.max(16, Math.min(64, Math.round(size)));
}

function findAvatarVisualElement(target) {
  return (
    target.querySelector("img.ytSpecAvatarShapeImage, img") ||
    (target.matches(AVATAR_VISUAL_SEL) ? target : target.querySelector(AVATAR_VISUAL_SEL))
  );
}

function captureAvatarLayout(template) {
  const target = findAvatarTarget(template);
  if (!target) return null;

  const fallback = defaultAvatarVisualSize(target);
  const outer = measureBox(target);
  const visualEl = findAvatarVisualElement(target);
  const visual = measureBox(visualEl || target);
  const visualSize = normalizeAvatarVisualSize(Math.min(visual.width, visual.height), fallback);

  return {
    outerWidth: normalizeAvatarBoxSize(outer.width, visualSize),
    outerHeight: normalizeAvatarBoxSize(outer.height, visualSize),
    visualSize,
  };
}

function captureRadii(template) {
  // Grab the card's outer radius (used for highlight ring) + the thumbnail
  // container's radius (used for our img wrapper). Computed styles only valid
  // while template is in DOM — so this must run before cloneNode.
  let card = "12px";
  const cardCs = window.getComputedStyle(template);
  const cardR = cardCs.getPropertyValue("border-radius");
  if (cardR && cardR !== "0px") card = cardR;

  let thumb = "12px";
  const thumbEl = template.querySelector(
    "yt-thumbnail-view-model, yt-image, ytd-thumbnail, #thumbnail"
  );
  if (thumbEl) {
    const cs = window.getComputedStyle(thumbEl);
    const r = cs.getPropertyValue("border-radius");
    if (r && r !== "0px") thumb = r;
    // ytd-thumbnail / #thumbnail (Polymer) may carry radius on inner img wrapper
    if (thumb === "0px" || !thumb) {
      const inner = thumbEl.querySelector("img, yt-image");
      if (inner) {
        const ir = window.getComputedStyle(inner).getPropertyValue("border-radius");
        if (ir && ir !== "0px") thumb = ir;
      }
    }
  }
  return { card, thumb };
}

// Capture the template card's outer box spacing while it's still in DOM.
// Locking these inline on the clone keeps the inter-card gap consistent on
// search results where sibling-combinator CSS doesn't always match the clone.
function captureCardSpacing(template) {
  const cs = window.getComputedStyle(template);
  return {
    marginTop: cs.marginTop,
    marginBottom: cs.marginBottom,
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
  };
}

/**
 * Replace yt-formatted-string custom elements with plain <span> elements
 * to prevent YouTube's Polymer framework from re-rendering our text overrides.
 */
const COPIED_STYLE_PROPS = [
  "color", "font-size", "font-weight", "font-family", "line-height",
  "letter-spacing", "text-transform", "text-decoration", "white-space",
  "overflow", "text-overflow", "display", "-webkit-line-clamp",
  "-webkit-box-orient", "max-height",
];

function captureFormattedStringStyles(template) {
  // Computed styles only valid on in-DOM elements. Capture from template
  // BEFORE cloning so we can re-apply onto the detached clone's spans.
  const styles = [];
  template.querySelectorAll("yt-formatted-string").forEach((el) => {
    const cs = window.getComputedStyle(el);
    let inline = "";
    for (const prop of COPIED_STYLE_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) inline += `${prop}:${v} !important;`;
    }
    styles.push(inline);
  });
  return styles;
}

function neutralizeFormattedStrings(node, capturedStyles) {
  const list = node.querySelectorAll("yt-formatted-string");
  const inDom = node.isConnected;
  list.forEach((el, i) => {
    const span = document.createElement("span");
    for (const attr of el.attributes) {
      try {
        span.setAttribute(attr.name, attr.value);
      } catch (e) {}
    }
    // Preserve YouTube's CSS that targeted yt-formatted-string by tag name.
    // Prefer live computed styles when in DOM; fall back to captured map.
    let inline = "";
    if (inDom) {
      const cs = window.getComputedStyle(el);
      for (const prop of COPIED_STYLE_PROPS) {
        const v = cs.getPropertyValue(prop);
        if (v) inline += `${prop}:${v} !important;`;
      }
    } else if (capturedStyles && capturedStyles[i]) {
      inline = capturedStyles[i];
    }
    if (inline) {
      const existing = span.getAttribute("style") || "";
      span.setAttribute("style", existing + ";" + inline);
    }
    span.innerHTML = el.innerHTML;
    el.replaceWith(span);
  });
}



function makeThumbImg(dataUrl) {
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  // ytCoreImageLoaded keeps the image visible against YT's loading-opacity CSS
  img.className = "ytCoreImageHost ytCoreImageLoaded";
  img.style.cssText =
    "position:absolute !important;inset:0 !important;width:100% !important;height:100% !important;object-fit:cover !important;display:block !important;opacity:1 !important;z-index:1 !important;";
  return img;
}

function makeThumbWrapper(dataUrl) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-ytlab-thumb", "1");
  // Inherit thumb radius from clone-level CSS var captured from live template
  // (set in buildSimNode via captureRadii). Matches each layout exactly.
  wrapper.style.cssText =
    "position:relative;width:100%;height:100%;aspect-ratio:16/9;background:#000;overflow:hidden;display:block;border-radius:var(--ytlab-thumb-radius, 12px);";
  wrapper.appendChild(makeThumbImg(dataUrl));
  return wrapper;
}

function imageHasSource(img) {
  return !!(
    img.currentSrc ||
    img.getAttribute("src") ||
    img.getAttribute("srcset") ||
    img.getAttribute("data-thumb")
  );
}

function thumbnailBoxForImage(img) {
  return img.closest("yt-thumbnail-view-model, ytd-thumbnail, a#thumbnail, #thumbnail, yt-image");
}

function hasUsableThumbnail(img) {
  if (!imageHasSource(img)) return false;
  if (img.complete && img.naturalWidth >= 16 && img.naturalHeight >= 9) return true;

  const imgRect = img.getBoundingClientRect();
  if (imgRect.width >= 16 && imgRect.height >= 9) return true;

  const box = thumbnailBoxForImage(img);
  if (!box) return false;
  const boxRect = box.getBoundingClientRect();
  return boxRect.width >= 80 && boxRect.height >= 45;
}

function thumbnailImages(node) {
  return Array.from(
    node.querySelectorAll(
      "yt-thumbnail-view-model img, ytd-thumbnail img, a#thumbnail img, #thumbnail img, yt-image img"
    )
  ).filter((img) => !img.closest(AVATAR_SELECTOR));
}

function findReadyThumbnailImage(node) {
  return thumbnailImages(node).find(hasUsableThumbnail) || null;
}

function hasDurationText(node) {
  return Array.from(
    node.querySelectorAll(
      "ytd-thumbnail-overlay-time-status-renderer #text, ytd-thumbnail-overlay-time-status-renderer span, .ytBadgeShapeText"
    )
  ).some((el) => /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/.test(el.textContent || ""));
}

function hasShortsSignal(node) {
  if (node.querySelector("a[href^='/shorts/'], a[href*='youtube.com/shorts/']")) return true;
  if (node.querySelector("ytd-thumbnail-overlay-time-status-renderer[overlay-style='SHORTS']")) return true;
  return Array.from(
    node.querySelectorAll(
      "ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-overlay-badge-view-model, ytd-badge-supported-renderer, badge-shape, .ytBadgeShapeText"
    )
  ).some((el) => /\bshorts\b/i.test(el.textContent || ""));
}

function isStandardSearchVideo(node) {
  if (location.pathname !== "/results") return true;
  if (!node.querySelector("a#video-title, h3 a#video-title")) return false;
  if (!node.querySelector("ytd-channel-name, #channel-name")) return false;
  if (hasShortsSignal(node)) return false;
  return hasDurationText(node);
}

function swapThumbnails(node, dataUrl) {
  if (!dataUrl) return;

  const existingThumbs = node.querySelectorAll("[data-ytlab-thumb] img");
  if (existingThumbs.length > 0) {
    existingThumbs.forEach((img) => {
      img.removeAttribute("srcset");
      img.src = dataUrl;
      markImageLoaded(img);
    });
    return;
  }

  let swapped = false;

  // 1. Replace yt-thumbnail-view-model entirely (homepage / watch sidebar)
  node.querySelectorAll("yt-thumbnail-view-model").forEach((vm) => {
    if (vm.closest(AVATAR_SELECTOR)) return;
    const overlays = vm.querySelectorAll(
      "yt-thumbnail-bottom-overlay-view-model, yt-thumbnail-overlay-badge-view-model, ytd-thumbnail-overlay-time-status-renderer"
    );
    const wrapper = makeThumbWrapper(dataUrl);
    overlays.forEach((o) => {
      o.style.cssText +=
        ";position:absolute;bottom:4px;right:4px;z-index:2;pointer-events:none;";
      wrapper.appendChild(o);
    });
    vm.replaceWith(wrapper);
    swapped = true;
  });

  // 2. Replace yt-image entirely (search results / older layouts)
  node.querySelectorAll("yt-image").forEach((yt) => {
    if (yt.closest(AVATAR_SELECTOR)) return;
    const overlays = yt.parentElement
      ? yt.parentElement.querySelectorAll(
          "yt-thumbnail-bottom-overlay-view-model, yt-thumbnail-overlay-badge-view-model, ytd-thumbnail-overlay-time-status-renderer"
        )
      : [];
    const wrapper = makeThumbWrapper(dataUrl);
    overlays.forEach((o) => {
      o.style.cssText +=
        ";position:absolute;bottom:4px;right:4px;z-index:2;pointer-events:none;";
      wrapper.appendChild(o);
    });
    yt.replaceWith(wrapper);
    swapped = true;
  });

  // 3. Set src on any remaining img elements (catch-all)
  if (!swapped) {
    node.querySelectorAll("img").forEach((img) => {
      if (img.closest(AVATAR_SELECTOR)) return;
      img.removeAttribute("srcset");
      img.src = dataUrl;
      img.style.setProperty("object-fit", "cover", "important");
      img.style.setProperty("object-position", "center", "important");
      img.style.opacity = "1";
      img.style.display = "block";
      img.removeAttribute("hidden");
      img.classList.add("ytCoreImageLoaded");
      swapped = true;
    });
  }

  // 4. Last resort: inject into any thumbnail-like container
  if (!swapped) {
    const container =
      node.querySelector("ytd-thumbnail") ||
      node.querySelector("#thumbnail") ||
      node.querySelector("a[href]");
    if (container) {
      container.style.position = "relative";
      container.style.display = "block";
      container.style.overflow = "hidden";
      container.appendChild(makeThumbImg(dataUrl));
    }
  }
}

function setTextAll(node, selectors, text, leafOnly = true) {
  if (!text) return;
  // First-match-wins. With leafOnly=true, skip matched elements that have
  // element children (wrappers — setting textContent would nuke inner spans
  // and sibling rows). With leafOnly=false, allow wrapper wipe (e.g. for
  // description blocks where the whole content should be replaced).
  for (const sel of selectors) {
    const matches = node.querySelectorAll(sel);
    if (matches.length === 0) continue;
    const targets = leafOnly
      ? Array.from(matches).filter((el) => el.childElementCount === 0)
      : Array.from(matches);
    if (targets.length === 0) continue;
    targets.forEach((target) => {
      target.textContent = text;
      if (target.hasAttribute("title")) target.setAttribute("title", text);
      if (target.hasAttribute("aria-label"))
        target.setAttribute("aria-label", text);
    });
    return;
  }
}

function setSearchText(target, text) {
  if (!target || !text) return;
  target.textContent = text;
  if (target.hasAttribute("title")) target.setAttribute("title", text);
  if (target.hasAttribute("aria-label")) target.setAttribute("aria-label", text);
}

// View-model layout (homepage rich-grid, watch sidebar) uses Lit-style camelCase
// classes like .ytContentMetadataViewModelMetadataRow. Polymer layout (search
// ytd-video-renderer) uses ids like #video-title and #metadata-line. Both lists
// kept here, ordered deepest-first so leaf-only setTextAll hits the inner span.

const TITLE_SELECTORS = [
  // View-model
  ".ytLockupMetadataViewModelTitle .ytAttributedStringHost",
  "a.ytLockupMetadataViewModelTitle span",
  "a.ytLockupMetadataViewModelTitle",
  // Polymer (search)
  "a#video-title yt-formatted-string",
  "a#video-title span",
  "a#video-title",
  "#video-title",
  "h3 a span",
  "h3 a",
  "h3",
];

const CHANNEL_SELECTORS = [
  // View-model channel row text (handled mainly in applyViewModelOverrides;
  // setTextAll's leaf-only filter skips spans containing the verified badge)
  // Polymer (search) — channel link inside ytd-channel-name
  "ytd-channel-name yt-formatted-string a",
  "ytd-channel-name #text a",
  "ytd-channel-name #text",
  "#channel-name yt-formatted-string a",
  "#channel-name yt-formatted-string",
  "#channel-name #text",
  "#byline a",
  "#byline",
];

const META_SELECTORS = [
  // Polymer (search) — multiple inline-metadata-item spans inside #metadata-line.
  // applyViewModelOverrides handles view-model rows directly.
  "#metadata-line span.inline-metadata-item",
  "#metadata-line span",
  ".inline-metadata-item",
];

const DURATION_SELECTORS = [
  // View-model — yt-thumbnail-bottom-overlay-view-model > badge-shape > .ytBadgeShapeText
  "yt-thumbnail-bottom-overlay-view-model .ytBadgeShapeText",
  "yt-thumbnail-bottom-overlay-view-model badge-shape div",
  ".ytThumbnailBottomOverlayViewModelBadge .ytBadgeShapeText",
  // Polymer (search) — ytd-thumbnail-overlay-time-status-renderer
  "ytd-thumbnail-overlay-time-status-renderer .ytBadgeShapeText",
  "ytd-thumbnail-overlay-time-status-renderer #text",
  "ytd-thumbnail-overlay-time-status-renderer span",
  ".thumbnail-overlay-badge-shape .ytBadgeShapeText",
];

const DESCRIPTION_SELECTORS = [
  ".metadata-snippet-text",
  ".metadata-snippet-text-navigation",
  "yt-formatted-string.metadata-snippet-text",
  "#description-text",
];

function applySearchOverrides(node, sim) {
  if (location.pathname !== "/results") return;

  setSearchText(node.querySelector("a#video-title, #video-title, h3 a"), sim.title);
  setSearchText(
    node.querySelector(
      "ytd-channel-name a, ytd-channel-name #text, #channel-name a, #channel-name #text, #byline a, #byline"
    ),
    sim.channel
  );

  if (sim.meta) {
    node.querySelectorAll("#metadata-line").forEach((line) => {
      line.innerHTML = "";
      const span = document.createElement("span");
      span.className = "inline-metadata-item style-scope ytd-video-meta-block";
      span.textContent = sim.meta;
      line.appendChild(span);
    });
  }
}

const STRIP_SELECTORS = [
  "ytd-video-summarization-search-renderer",
  "ytd-search-video-summarization-renderer",
  "ytd-inline-summary-renderer",
  "yt-search-video-summarization",
  "[is-search-summary]",
  "ytd-horizontal-card-list-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-sparkles-text-search-renderer",
  "ytd-badge-supported-renderer",
  "ytd-channel-renderer",
  "ytd-expandable-metadata-renderer",
  "#expandable-metadata",
  "ytd-action-companion-ad-renderer",
  "ytd-shelf-renderer",
  "#chapters",
  "#inline-preview-player",
  // Watch-progress / resume overlay — leaks red bar onto cloned sim thumbnail
  "ytd-thumbnail-overlay-resume-playback-renderer",
  "yt-thumbnail-overlay-progress-bar-view-model",
  ".ytThumbnailOverlayProgressBarHost",
  "#progress",
];

function stripClutter(node) {
  STRIP_SELECTORS.forEach((sel) => {
    node.querySelectorAll(sel).forEach((el) => el.remove());
  });
}

function setMetaTextNode(span, text) {
  // Replace the first text node, drop any later text nodes, but preserve
  // sibling element children (verified-badge SVG, etc.). Without dropping
  // later text nodes, leftover text from the cloned template could get
  // concatenated to sim.channel (e.g. "Force QuitBoughtYouThisThing").
  let firstSet = false;
  const toRemove = [];
  for (const node of span.childNodes) {
    if (node.nodeType !== 3) continue;
    if (!firstSet) {
      node.nodeValue = text;
      firstSet = true;
    } else {
      toRemove.push(node);
    }
  }
  toRemove.forEach((n) => n.remove());
  if (!firstSet) {
    span.insertBefore(document.createTextNode(text), span.firstChild);
  }
}

function buildMetaRow(text) {
  const row = document.createElement("div");
  row.className = "ytContentMetadataViewModelMetadataRow";
  row.setAttribute("tabindex", "0");
  row.setAttribute("role", "group");
  row.setAttribute("data-ytlab-meta-row", "1");
  const parts = text.split(/\s*[•·]\s*/);
  parts.forEach((part, i) => {
    if (i > 0) {
      const delim = document.createElement("span");
      delim.className = "ytContentMetadataViewModelDelimiter";
      delim.setAttribute("aria-hidden", "true");
      delim.textContent = " • ";
      row.appendChild(delim);
    }
    const span = document.createElement("span");
    span.className =
      "ytAttributedStringHost ytContentMetadataViewModelMetadataText ytAttributedStringWhiteSpacePreWrap ytAttributedStringLinkInheritColor";
    span.setAttribute("dir", "auto");
    span.setAttribute("role", "text");
    span.textContent = part;
    row.appendChild(span);
  });
  return row;
}

function applyViewModelOverrides(node, sim) {
  // View-model layout (homepage rich-grid + watch sidebar). Real classes are
  // camelCase: ytContentMetadataViewModelHost / MetadataRow / MetadataText.
  // metaContainer is the yt-content-metadata-view-model element OR (post-freeze)
  // any descendant carrying the same class chain.
  const metaContainer = node.querySelector(
    "yt-content-metadata-view-model, .ytContentMetadataViewModelHost"
  );
  if (!metaContainer) return;

  const rows = Array.from(
    metaContainer.querySelectorAll(".ytContentMetadataViewModelMetadataRow")
  );

  // Classify rows by content. Channel row holds a channel link or avatar
  // sibling; meta row matches views/ago pattern. Skip our own injected row.
  const channelLinkSel =
    "a[href*='@'], a[href*='/channel/'], a[href*='/c/'], a[href*='/user/']";
  const metaPattern = /(view|watching|ago|month|year|day|hour|min|streamed|premiered)/i;

  let channelRow = null;
  let metaRow = null;
  for (const row of rows) {
    if (row.getAttribute("data-ytlab-meta-row") === "1") continue;
    if (!channelRow && (row.querySelector(channelLinkSel) || row.querySelector(".ytSpecAvatarShapeImage"))) {
      channelRow = row;
      continue;
    }
    if (!metaRow && metaPattern.test(row.textContent || "")) {
      metaRow = row;
      continue;
    }
  }
  // If no row had a channel link/avatar, fall back to first row that ISN'T
  // the meta row (avoids using "New" badge row as channel).
  if (!channelRow) {
    channelRow = rows.find(
      (r) => r !== metaRow && r.getAttribute("data-ytlab-meta-row") !== "1"
    ) || null;
  }

  if (sim.channel && channelRow) {
    // Wipe the row entirely and put a single channel span in. Anything else
    // in the cloned channel row (secondary metadata-text spans, subscribe
    // buttons, "subscribed" labels, leftover text nodes) was leaking onto
    // sim.channel as concatenated text.
    channelRow.innerHTML = "";
    const span = document.createElement("span");
    span.className =
      "ytAttributedStringHost ytContentMetadataViewModelMetadataText ytAttributedStringWhiteSpacePreWrap ytAttributedStringLinkInheritColor";
    span.setAttribute("dir", "auto");
    span.setAttribute("role", "text");
    span.textContent = sim.channel;
    channelRow.appendChild(span);
  }

  if (sim.meta) {
    // Remove any previously-injected meta rows so reapplies don't stack
    metaContainer.querySelectorAll('[data-ytlab-meta-row="1"]').forEach((el) => el.remove());

    if (metaRow) {
      // Repopulate template's existing meta row in place (no marker — we
      // want pattern-matching to find it again on next reapply, not delete
      // and re-insert it).
      metaRow.innerHTML = "";
      const fresh = buildMetaRow(sim.meta);
      while (fresh.firstChild) metaRow.appendChild(fresh.firstChild);
      metaRow.removeAttribute("data-ytlab-meta-row");
    } else {
      // No existing meta row — insert a new one right after the channel row
      const newRow = buildMetaRow(sim.meta);
      if (channelRow && channelRow.parentNode) {
        channelRow.after(newRow);
      } else {
        metaContainer.insertBefore(newRow, metaContainer.firstElementChild);
      }
    }
  }
}

function aggressiveSwap(node, sim) {
  // Channel: any anchor whose href looks like a channel URL.
  // Skip:
  //   - avatar wrappers (anchor containing img) — would nuke the img and
  //     duplicate the channel name next to the avatar
  //   - anchors inside a view-model metadata row, since
  //     applyViewModelOverrides already wrote the channel there (otherwise
  //     this writes a second copy in the same row)
  if (sim.channel) {
    node.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!(/^\/(@|channel\/|c\/|user\/)/.test(href) || /^https?:\/\/[^/]*youtube\.com\/(@|channel\/|c\/|user\/)/.test(href))) return;
      if (a.querySelector("img, yt-img-shadow, yt-avatar-shape, .yt-avatar-shape, #avatar, #channel-thumbnail")) return;
      if (a.closest(AVATAR_SELECTOR)) return;
      if (a.closest(".ytContentMetadataViewModelMetadataRow, .ytLockupMetadataViewModelHost")) return;
      a.textContent = sim.channel;
    });
  }

  // Duration: any leaf element whose text matches mm:ss / h:mm:ss
  if (sim.duration) {
    node.querySelectorAll("*").forEach((el) => {
      if (el.children.length === 0) {
        const t = (el.textContent || "").trim();
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
          el.textContent = sim.duration;
        }
      }
    });
  }

  // Meta line: replace whole #metadata-line content with a single inline span
  if (sim.meta) {
    node.querySelectorAll("#metadata-line").forEach((line) => {
      line.innerHTML = "";
      const span = document.createElement("span");
      span.className = "inline-metadata-item style-scope ytd-video-meta-block";
      span.textContent = sim.meta;
      line.appendChild(span);
    });
  }
}

function markImageLoaded(img) {
  img.classList.add("ytCoreImageLoaded");
  img.removeAttribute("hidden");
  img.style.setProperty("opacity", "1", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("visibility", "visible", "important");
}

function removeDuplicateAvatarTargets(node, target) {
  avatarCandidates(node).forEach((candidate) => {
    if (candidate === target || candidate.contains(target) || target.contains(candidate)) return;
    candidate.remove();
  });
}

function removeExtraAvatarPaint(node, target) {
  node
    .querySelectorAll("[data-ytlab-avatar-root], [data-ytlab-avatar-visual], img.ytSpecAvatarShapeImage")
    .forEach((el) => {
      if (el === target || target.contains(el) || el.contains(target)) return;
      if (el.closest("[data-ytlab-thumb], ytd-thumbnail, yt-thumbnail-view-model")) return;
      const wrapper =
        el.closest(AVATAR_CONTAINER_SEL) ||
        el.closest("a, ytd-channel-avatar, yt-avatar-shape, .yt-avatar-shape") ||
        el;
      if (wrapper && wrapper !== target && !wrapper.contains(target)) wrapper.remove();
    });
}

function storedAvatarLayout(node, target) {
  const fallback = defaultAvatarVisualSize(target);
  const visualSize = normalizeAvatarVisualSize(readPx(node.getAttribute("data-ytlab-avatar-visual-size")), fallback);
  return {
    outerWidth: normalizeAvatarBoxSize(readPx(node.getAttribute("data-ytlab-avatar-outer-width")), visualSize),
    outerHeight: normalizeAvatarBoxSize(readPx(node.getAttribute("data-ytlab-avatar-outer-height")), visualSize),
    visualSize,
  };
}

function writeAvatarLayout(node, layout) {
  if (!layout) return;
  node.setAttribute("data-ytlab-avatar-outer-width", String(layout.outerWidth));
  node.setAttribute("data-ytlab-avatar-outer-height", String(layout.outerHeight));
  node.setAttribute("data-ytlab-avatar-visual-size", String(layout.visualSize));
}

function writeCardSpacing(node, spacing) {
  if (!spacing) return;
  node.style.setProperty("margin-top", spacing.marginTop, "important");
  node.style.setProperty("margin-bottom", spacing.marginBottom, "important");
  node.style.setProperty("padding-top", spacing.paddingTop, "important");
  node.style.setProperty("padding-bottom", spacing.paddingBottom, "important");
}

function styleBox(el, width, height) {
  const w = `${width}px`;
  const h = `${height}px`;
  el.style.setProperty("width", w, "important");
  el.style.setProperty("height", h, "important");
  el.style.setProperty("min-width", w, "important");
  el.style.setProperty("min-height", h, "important");
  el.style.setProperty("max-width", w, "important");
  el.style.setProperty("max-height", h, "important");
  el.style.setProperty("box-sizing", "border-box", "important");
}

function swapAvatar(node, dataUrl, avatarLayout) {
  const target = findAvatarTarget(node);
  if (!target) return;

  const layout = avatarLayout || storedAvatarLayout(node, target);
  writeAvatarLayout(node, layout);
  removeDuplicateAvatarTargets(node, target);

  const existingImg = target.querySelector("img");
  if (!existingImg && !dataUrl) return;

  const img = existingImg || document.createElement("img");
  if (dataUrl) {
    img.removeAttribute("srcset");
    img.src = dataUrl;
  }
  img.classList.add("ytCoreImageHost", "ytSpecAvatarShapeImage", "ytCoreImageLoaded");
  img.alt = "";
  img.style.setProperty("position", "absolute", "important");
  img.style.setProperty("inset", "0", "important");
  img.style.setProperty("width", "100%", "important");
  img.style.setProperty("height", "100%", "important");
  img.style.setProperty("object-fit", "cover", "important");
  img.style.setProperty("object-position", "center", "important");
  img.style.setProperty("border-radius", "50%", "important");
  markImageLoaded(img);

  const visual = document.createElement("span");
  visual.setAttribute("data-ytlab-avatar-visual", "1");
  visual.style.setProperty("position", "relative", "important");
  visual.style.setProperty("display", "block", "important");
  visual.style.setProperty("border-radius", "50%", "important");
  visual.style.setProperty("clip-path", "circle(50%)", "important");
  visual.style.setProperty("overflow", "hidden", "important");
  visual.style.setProperty("background", "transparent", "important");
  visual.style.setProperty("flex", "0 0 auto", "important");
  styleBox(visual, layout.visualSize, layout.visualSize);

  target.setAttribute("data-ytlab-avatar-root", "1");
  target.style.setProperty("position", "relative", "important");
  target.style.setProperty("display", "inline-flex", "important");
  target.style.setProperty("align-items", "center", "important");
  target.style.setProperty("justify-content", "center", "important");
  target.style.setProperty("background", "transparent", "important");
  target.style.setProperty("overflow", "visible", "important");
  target.style.setProperty("clip-path", "none", "important");
  target.style.setProperty("border-radius", "0", "important");
  target.style.setProperty("padding", "0", "important");
  target.style.setProperty("margin", "0", "important");
  target.style.setProperty("flex", "0 0 auto", "important");
  styleBox(target, layout.outerWidth, layout.outerHeight);

  target.replaceChildren(visual);
  visual.appendChild(img);
  removeExtraAvatarPaint(node, target);
}

function applyAllSwaps(node, sim, capturedStyles, avatarLayout) {
  sim = normalizeSim(sim);
  if (!sim) return;
  neutralizeFormattedStrings(node, capturedStyles);
  swapThumbnails(node, sim.thumbnail);
  swapAvatar(node, sim.avatar, avatarLayout);
  setTextAll(node, TITLE_SELECTORS, sim.title);
  setTextAll(node, CHANNEL_SELECTORS, sim.channel);
  setTextAll(node, META_SELECTORS, sim.meta);
  setTextAll(node, DESCRIPTION_SELECTORS, sim.description, false);
  setTextAll(node, DURATION_SELECTORS, sim.duration);

  // Layout-specific overrides
  applyViewModelOverrides(node, sim);

  // Catch-all for any structure my selectors missed
  aggressiveSwap(node, sim);

  // Final search pass. Polymer search cards can restore their own text during
  // connection, so the exact title/channel nodes get rewritten last.
  applySearchOverrides(node, sim);
}

function applyHighlight(node, sim) {
  if (sim.highlight !== false) {
    const color = sim.highlightColor || "#00ff88";
    node.style.setProperty("--ytlab-hl-color", color);
    node.classList.add("ytlab-sim-highlight");
  } else {
    node.classList.remove("ytlab-sim-highlight");
  }
}

/**
 * Watch a cloned node for YouTube's Polymer trying to update it,
 * and re-apply our text overrides when that happens.
 */


/**
 * Replace any yt-* (Lit, BEM-class-based) custom element with a plain div,
 * preserving attributes and children. Lit elements re-render to empty on
 * connectedCallback when no data binding exists, wiping our cloned content.
 * Skip ytd-* (Polymer, relies on tag-targeted CSS for layout) — keep their
 * native tags so layout stays intact.
 *
 * Applied across the whole clone tree so homepage / search variants where
 * a yt-lockup-view-model is nested inside ytd-rich-item-renderer also work.
 */
function freezeLitElements(rootEl) {
  const isLit = (el) => /^yt-/i.test(el.tagName);
  const all = [];
  const walk = (n) => {
    if (n.nodeType !== 1) return;
    if (isLit(n)) all.push(n);
    for (const child of Array.from(n.children)) walk(child);
  };
  walk(rootEl);

  // Bottom-up so children are already replaced when we touch their parent
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i];
    const div = document.createElement("div");
    for (const attr of el.attributes) {
      try { div.setAttribute(attr.name, attr.value); } catch (e) {}
    }
    div.setAttribute("data-ytlab-orig-tag", el.tagName.toLowerCase());
    while (el.firstChild) div.appendChild(el.firstChild);
    if (el.parentNode) {
      el.replaceWith(div);
    } else if (el === rootEl) {
      rootEl = div;
    }
  }
  return rootEl;
}

function buildSimNode(sim, template) {
  // Capture computed styles from the in-DOM template before cloning.
  // Search keeps a rectangular avatar hitbox with a smaller circular image
  // inside it, so capture both boxes before yt-* wrappers are frozen.
  const capturedStyles = captureFormattedStringStyles(template);
  const avatarLayout = captureAvatarLayout(template);
  const radii = captureRadii(template);
  const spacing = captureCardSpacing(template);

  let clone = template.cloneNode(true);
  clone.setAttribute(SIM_ATTR, "1");
  clone.removeAttribute("id");
  clone.style.setProperty("--ytlab-card-radius", radii.card);
  clone.style.setProperty("--ytlab-thumb-radius", radii.thumb);
  writeAvatarLayout(clone, avatarLayout);

  stripClutter(clone);
  applyAllSwaps(clone, sim, capturedStyles, avatarLayout);
  neutralizeLinks(clone);

  // Freeze yt-* (Lit) elements anywhere in the tree. Done after child swaps
  // so nested queries match real tag names. ytd-* (Polymer) tags stay so
  // tag-targeted layout CSS keeps working on homepage / search.
  clone = freezeLitElements(clone);
  applyAllSwaps(clone, sim, null, avatarLayout);

  writeCardSpacing(clone, spacing);
  applyHighlight(clone, sim);

  return clone;
}

function injectOnce() {
  const sim = currentState.sim;
  if (!sim || !sim.enabled) {
    removeInjected();
    return;
  }
  if (!sim.thumbnail && !sim.title) {
    return;
  }

  // Don't double-inject, unless a stale/hidden sim was inserted before the
  // current page's target container finished loading.
  const existing = document.querySelector(`[${SIM_ATTR}]`);
  if (existing) {
    if (existingSimLooksValid(existing)) return;
    existing.remove();
  }

  const target = findContainerAndTemplate();
  if (!target) {
    return false; // signal failure so caller can retry
  }

  const isTemplateSource = (el) => {
    if (isAd(el)) return false;
    if (!hasCardTitle(el)) return false;
    if (!findReadyThumbnailImage(el)) return false;
    return isStandardSearchVideo(el);
  };

  const positionItems = getAnchorablePositionItems(target);
  const readyItems = target.items.filter(isTemplateSource);
  const template = readyItems[0] || null;
  // If nothing populated yet, signal failure so the retry chain / poller
  // tries again once the lazy-loaded data arrives.
  if (!template) return false;

  const insertIdx = resolveAnchorIndex(positionItems, target.page);
  const anchor = positionItems[insertIdx];
  const clone = buildSimNode(sim, template);
  if (anchor) {
    anchor.parentNode.insertBefore(clone, anchor);
    pinnedAnchor[target.page] = cardId(anchor);
    pinnedAnchorMode[target.page] = "el";
  } else {
    return false;
  }

  applyAllSwaps(clone, sim);
  applyHighlight(clone, sim);
  freezeLitElements(clone);

  // Delayed re-applications to fight Polymer re-renders
  [0, 50, 150, 400, 800, 1500, 3000].forEach((delay) => {
    setScopedTimeout(() => {
      if (!clone.isConnected) return;
      applyAllSwaps(clone, sim);
      applyHighlight(clone, sim);
      freezeLitElements(clone);
    }, delay);
  });
  return true; // success
}

function scheduleInject() {
  if (pending) return;
  pending = setScopedTimeout(() => {
    pending = null;
    try {
      const ok = injectOnce();
      // Retry on inject failure. Watch sidebar lazy-loads slowest; home/search
      // cards arrive faster but can still race the MutationObserver during
      // SPA route changes (Home → Search disappear-until-refresh bug).
      if (ok === false) {
        const isWatch = location.pathname === "/watch";
        const delays = isWatch
          ? [500, 1000, 2000, 3500, 5500, 8000, 12000]
          : [300, 700, 1400, 2500, 4000, 6500];
        delays.forEach((delay) => {
          setScopedTimeout(() => {
            if (!document.querySelector(`[${SIM_ATTR}]`)) {
              injectOnce();
            }
          }, delay);
        });
      }
    } catch (e) {
      // swallow; next mutation will retry
    }
  }, 200);
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => scheduleInject());
  const root = document.body || document.documentElement;
  if (!root) {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    return;
  }
  observer.observe(root, { childList: true, subtree: true });
  scheduleInject();
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}

let injectPoller = null;

function isSupportedPath() {
  return !!getRoutePage();
}

function startInjectPoller() {
  // Page content can lazy-load slowly on any of the 3 pages — watch sidebar
  // is the worst (>30s after SPA nav from /results). Keep ticking the entire
  // time the user is on a supported page with sim enabled. Don't stop when
  // [data-ytlab-sim] appears — YouTube's renderer can wipe the clone right
  // after insertion (Polymer/Lit re-render), and the poller is what brings
  // it back. injectOnce short-circuits early when sim is already present, so
  // continuous ticking is cheap.
  if (injectPoller) return;
  if (!isSupportedPath()) return;
  if (!currentState.sim || !currentState.sim.enabled) return;
  injectPoller = setInterval(() => {
    if (
      !isSupportedPath() ||
      !currentState.sim ||
      !currentState.sim.enabled
    ) {
      clearInterval(injectPoller);
      injectPoller = null;
      return;
    }
    injectOnce();
  }, 1000);
}

function stopInjectPoller() {
  if (injectPoller) { clearInterval(injectPoller); injectPoller = null; }
}

function assetWasCleared(prevSim, nextSim) {
  if (!prevSim || !nextSim) return false;
  return (!!prevSim.thumbnail && !nextSim.thumbnail) || (!!prevSim.avatar && !nextSim.avatar);
}

function patchExistingSim(sim) {
  const clone = document.querySelector(`[${SIM_ATTR}]`);
  if (!clone) return false;
  applyAllSwaps(clone, sim);
  applyHighlight(clone, sim);
  return true;
}

function beginFreshInject() {
  nextGeneration();
  clearScopedTimers();
  removeInjected();
  if (!isSupportedPath() || !currentState || !currentState.sim || !currentState.sim.enabled) {
    stopObserver();
    stopInjectPoller();
    return;
  }
  startObserver();
  scheduleInject();
  startInjectPoller();
}

function onNavigate() {
  const key = getRouteKey();
  const routeChanged = key !== lastRouteKey;
  if (key !== lastRouteKey) {
    lastRouteKey = key;
    const page = getRoutePage();
    if (page) {
      pinnedAnchor[page] = null;
      pinnedAnchorMode[page] = defaultModeFor();
    }
  }
  if (
    routeChanged ||
    !document.querySelector(`[${SIM_ATTR}]`) ||
    !isSupportedPath() ||
    !currentState ||
    !currentState.sim ||
    !currentState.sim.enabled
  ) {
    beginFreshInject();
  }
}

function applyAll(state) {
  const previousState = currentState;
  const nextState = state ? { ...state, sim: normalizeSim(state.sim) } : state;
  currentState = nextState;
  applyGrayscale(nextState.active);

  if (!nextState.sim || !nextState.sim.enabled || !isSupportedPath()) {
    beginFreshInject();
    return;
  }

  const needsFreshTemplate = assetWasCleared(previousState && previousState.sim, nextState.sim);

  if (!needsFreshTemplate && patchExistingSim(nextState.sim)) return;
  beginFreshInject();
}

function handleNudge(direction) {
  const page = getRoutePage();
  if (!page) return;
  const target = findContainerAndTemplate();
  if (!target) return;
  const positionItems = getAnchorablePositionItems(target);
  const len = positionItems.length;
  if (len === 0) return;

  const pinnedId = pinnedAnchor[page];
  let curIdx = pinnedId
    ? positionItems.findIndex((el) => cardId(el) === pinnedId)
    : -1;
  if (curIdx >= 0) {
    const r = positionItems[curIdx].getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < window.innerHeight;
    if (!visible) curIdx = getViewportCenterIndex(positionItems);
  } else {
    curIdx = getViewportCenterIndex(positionItems);
  }

  let newIdx;
  if (direction === "next") newIdx = Math.min(curIdx + 1, len - 1);
  else if (direction === "prev") newIdx = Math.max(curIdx - 1, 0);
  else newIdx = getViewportCenterIndex(positionItems);

  pinnedAnchor[page] = cardId(positionItems[newIdx]);
  pinnedAnchorMode[page] = "el";
  beginFreshInject();
}

function fetchState(retries = 5) {
  // Service worker may be cold-starting on first load — first message can
  // come back undefined. Retry with backoff until we get a valid state.
  chrome.runtime.sendMessage({ type: "ytlab:getState" }, (state) => {
    if (chrome.runtime.lastError || !state) {
      if (retries > 0) setTimeout(() => fetchState(retries - 1), 400);
      return;
    }
    hasFetchedState = true;
    applyAll(state);
  });
}
fetchState();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "ytlab:nudge" && msg.direction) {
    handleNudge(msg.direction);
    return;
  }
  if (msg && msg.type === "ytlab:setState" && msg.state) {
    hasFetchedState = true;
    applyAll(msg.state);
  }
  if (msg && msg.type === "ytlab:patchSim" && msg.sim) {
    if (!hasFetchedState) {
      fetchState();
      return;
    }
    applyAll({
      ...(currentState || { active: false }),
      sim: {
        ...((currentState && currentState.sim) || {}),
        ...msg.sim,
      },
    });
  }
});

function handleNavigate() {
  // Re-fetch state on navigate in case the initial fetch raced with a cold
  // service worker. If we already have state, just trigger the inject path.
  if (!hasFetchedState) fetchState();
  onNavigate();
}
window.addEventListener("yt-navigate-finish", handleNavigate);
window.addEventListener("yt-page-data-updated", handleNavigate);

// Fallback URL watcher — yt-navigate-finish doesn't always fire on SPA nav
// in current YouTube builds. Track query too: /results search changes often
// keep the same pathname.
setInterval(() => {
  if (getRouteKey() !== lastRouteKey) {
    handleNavigate();
  }
}, 500);
