const ROOT_CLASS = "ytlab-active";
const SIM_ATTR = "data-ytlab-sim";

let currentState = { active: true, sim: { enabled: false } };
let observer = null;
let pending = null;

function applyGrayscale(active) {
  const root = document.documentElement;
  if (!root) return;
  if (active) root.classList.add(ROOT_CLASS);
  else root.classList.remove(ROOT_CLASS);
}

function removeInjected() {
  document.querySelectorAll(`[${SIM_ATTR}]`).forEach((n) => n.remove());
}

function findByAncestorItem(itemTag, index) {
  const items = Array.from(
    document.querySelectorAll(`${itemTag}:not([${SIM_ATTR}])`)
  );
  if (items.length === 0) return null;
  const container = items[0].parentElement;
  if (!container) return null;
  const siblings = Array.from(container.children).filter(
    (el) => el.tagName.toLowerCase() === itemTag && !el.hasAttribute(SIM_ATTR)
  );
  if (siblings.length === 0) return null;
  return {
    container,
    itemTag,
    items: siblings,
    index: Math.min(index, siblings.length),
  };
}

function findItemsInScope(scope, itemTag) {
  const items = Array.from(
    scope.querySelectorAll(`${itemTag}:not([${SIM_ATTR}])`)
  );
  if (items.length === 0) return null;
  const container = items[0].parentElement;
  if (!container) return null;
  const siblings = Array.from(container.children).filter(
    (el) => el.tagName.toLowerCase() === itemTag && !el.hasAttribute(SIM_ATTR)
  );
  if (siblings.length === 0) return null;
  return {
    container,
    itemTag,
    items: siblings,
    index: Math.min(1, siblings.length),
  };
}

function findContainerAndTemplate() {
  const path = location.pathname;
  if (path === "/" || path.startsWith("/feed")) {
    return findByAncestorItem("ytd-rich-item-renderer", 1);
  }
  if (path === "/results") {
    return findByAncestorItem("ytd-video-renderer", 1);
  }
  if (path === "/watch") {
    // Find the sidebar container — YouTube uses several possible structures
    const sidebar =
      document.querySelector("#secondary") ||
      document.querySelector("#related") ||
      document.querySelector("ytd-watch-next-secondary-results-renderer");

    const scope = sidebar || document;

    // Try all known video item types inside the sidebar
    const itemTypes = [
      "yt-lockup-view-model",
      "ytd-compact-video-renderer",
      "ytd-rich-item-renderer",
      "ytd-video-renderer",
    ];

    for (const tag of itemTypes) {
      const result = findItemsInScope(scope, tag);
      if (result) return result;
    }

    // Fallback: search inside item-section-renderer #contents
    const sections = scope.querySelectorAll("ytd-item-section-renderer #contents");
    for (const section of sections) {
      for (const tag of itemTypes) {
        const result = findItemsInScope(section, tag);
        if (result) return result;
      }
    }

    return null;
  }
  return null;
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
  "#avatar, #channel-thumbnail, ytd-channel-avatar, yt-avatar-shape, .yt-avatar-shape, #avatar-container, yt-img-shadow";

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
    "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:1;z-index:1;";
  return img;
}

function makeThumbWrapper(dataUrl, sourceEl) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-ytlab-thumb", "1");
  // Mirror the original thumbnail's border-radius so corners stay rounded
  // on homepage / watch sidebar (search already wraps in a rounded parent).
  let radius = "12px";
  if (sourceEl && sourceEl.isConnected) {
    const cs = window.getComputedStyle(sourceEl);
    const r = cs.getPropertyValue("border-radius");
    if (r && r !== "0px") radius = r;
  }
  wrapper.style.cssText =
    `position:relative;width:100%;height:100%;aspect-ratio:16/9;background:#000;overflow:hidden;display:block;border-radius:${radius};`;
  wrapper.appendChild(makeThumbImg(dataUrl));
  return wrapper;
}

function swapThumbnails(node, dataUrl) {
  if (!dataUrl) return;

  // Skip if we already swapped thumbnails in this node
  if (node.querySelector("[data-ytlab-thumb]")) return;

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
  // YT's ytCore image system keeps imgs at opacity:0 until it adds
  // .ytCoreImageLoaded after the natural load event. When we replace src
  // with a data URL, that flag never fires for cloned imgs — the image stays
  // invisible. Add the class manually so YT's CSS reveals the element.
  img.classList.add("ytCoreImageLoaded");
  img.removeAttribute("hidden");
}

function swapAvatar(node, dataUrl) {
  if (!dataUrl) return;
  // Swap every outermost avatar container. Don't force display:block on imgs
  // — the previous "3 avatars" bug came from unhiding hidden duplicate imgs
  // inside a single container, not from multiple containers. Just rewrite
  // src on the first <img> per container; secondary hidden imgs stay hidden.
  const containerSel =
    "#avatar, #channel-thumbnail, ytd-channel-avatar, yt-avatar-shape, .yt-avatar-shape, #avatar-container, yt-img-shadow, a#avatar-link";
  const containers = Array.from(node.querySelectorAll(containerSel)).filter(
    (c) => c.closest(containerSel) === c
  );
  containers.forEach((container) => {
    const img = container.querySelector("img");
    if (img) {
      img.removeAttribute("srcset");
      img.src = dataUrl;
      markImageLoaded(img);
    } else {
      const newImg = document.createElement("img");
      newImg.src = dataUrl;
      newImg.className = "ytCoreImageHost ytSpecAvatarShapeImage ytCoreImageLoaded";
      newImg.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;";
      container.appendChild(newImg);
    }
  });
}

function applyAllSwaps(node, sim, capturedStyles) {
  neutralizeFormattedStrings(node, capturedStyles);
  swapThumbnails(node, sim.thumbnail);
  swapAvatar(node, sim.avatar);
  setTextAll(node, TITLE_SELECTORS, sim.title);
  setTextAll(node, CHANNEL_SELECTORS, sim.channel);
  setTextAll(node, META_SELECTORS, sim.meta);
  setTextAll(node, DESCRIPTION_SELECTORS, sim.description, false);
  setTextAll(node, DURATION_SELECTORS, sim.duration);

  // Layout-specific overrides
  applyViewModelOverrides(node, sim);

  // Catch-all for any structure my selectors missed
  aggressiveSwap(node, sim);
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
  // Capture computed styles from in-DOM template before cloning
  const capturedStyles = captureFormattedStringStyles(template);

  let clone = template.cloneNode(true);
  clone.setAttribute(SIM_ATTR, "1");
  clone.removeAttribute("id");

  stripClutter(clone);
  applyAllSwaps(clone, sim, capturedStyles);
  neutralizeLinks(clone);

  // Freeze yt-* (Lit) elements anywhere in the tree. Done after child swaps
  // so nested queries match real tag names. ytd-* (Polymer) tags stay so
  // tag-targeted layout CSS keeps working on homepage / search.
  clone = freezeLitElements(clone);

  // Green highlight. outline previously broke insertion of the live
  // yt-lockup-view-model custom element, but the frozen-to-div clone handles
  // it fine. box-shadow gets clipped by parent overflow:hidden in the watch
  // sidebar, so use outline.
  if (sim.highlight !== false) {
    clone.style.outline = "2px solid #00ff88";
    clone.style.outlineOffset = "2px";
  }

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

  // Don't double-inject
  if (document.querySelector(`[${SIM_ATTR}]`)) return;

  const target = findContainerAndTemplate();
  if (!target) {
    return false; // signal failure so caller can retry
  }

  // Skip ad elements when picking a template
  const isAd = (el) => {
    if (!el) return false;
    return (
      el.querySelector("ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-action-companion-ad-renderer, [is-ad], ad-slot-renderer") ||
      el.hasAttribute("is-ad") ||
      el.querySelector("[aria-label*='Sponsored'], [aria-label*='Ad']")
    );
  };

  // A populated card has a real title + thumbnail. Empty placeholders (data
  // still loading) produce a sim card with green outline and no content.
  const isPopulated = (el) => {
    if (!el) return false;
    const titleText = (
      el.querySelector(".ytLockupMetadataViewModelTitle, a#video-title, h3 a") || el
    ).textContent || "";
    if (titleText.trim().length < 2) return false;
    const img = el.querySelector("img");
    if (!img || !img.getAttribute("src")) return false;
    return true;
  };

  let template = null;
  for (const item of target.items) {
    if (isAd(item)) continue;
    if (!isPopulated(item)) continue;
    template = item;
    break;
  }
  // If nothing populated yet, signal failure so the retry chain / poller
  // tries again once the lazy-loaded data arrives.
  if (!template) return false;

  const anchor = target.items[Math.min(target.index, target.items.length - 1)];
  const clone = buildSimNode(sim, template);
  if (anchor) target.container.insertBefore(clone, anchor);
  else target.container.appendChild(clone);

  // Delayed re-applications to fight Polymer re-renders
  [50, 150, 400, 800, 1500, 3000].forEach((delay) => {
    setTimeout(() => {
      if (!clone.isConnected) return;
      applyAllSwaps(clone, sim);
    }, delay);
  });
  return true; // success
}

function scheduleInject() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try {
      const ok = injectOnce();
      // If inject failed on a watch page, retry — sidebar loads late.
      // Extended schedule covers slow connections / cold cache.
      if (ok === false && location.pathname === "/watch") {
        [500, 1000, 2000, 3500, 5500, 8000, 12000].forEach((delay) => {
          setTimeout(() => {
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

let watchPoller = null;

function startWatchPoller() {
  // Sidebar lazy-loads on /watch. Mutation observer can stop firing once the
  // page settles, and yt-navigate-finish doesn't fire on hard reloads — so a
  // dedicated poller keeps trying until injection succeeds. ~30s window.
  if (watchPoller) return;
  if (location.pathname !== "/watch") return;
  if (!currentState.sim || !currentState.sim.enabled) return;
  let attempts = 0;
  watchPoller = setInterval(() => {
    attempts++;
    if (document.querySelector(`[${SIM_ATTR}]`) || attempts > 20) {
      clearInterval(watchPoller);
      watchPoller = null;
      return;
    }
    injectOnce();
  }, 1500);
}

function stopWatchPoller() {
  if (watchPoller) { clearInterval(watchPoller); watchPoller = null; }
}

function onNavigate() {
  removeInjected();
  pending = null;
  stopWatchPoller();
  scheduleInject();
  startWatchPoller();
}

function applyAll(state) {
  currentState = state;
  applyGrayscale(state.active);

  if (state.sim && state.sim.enabled) {
    // Always remove + re-inject so changed fields (thumb/title/avatar/etc.) appear.
    removeInjected();
    startObserver();
    pending = null;
    scheduleInject();
    // Cover the hard-reload case where yt-navigate-finish never fires
    startWatchPoller();
  } else {
    removeInjected();
    stopWatchPoller();
  }
}

function fetchState(retries = 5) {
  // Service worker may be cold-starting on first load — first message can
  // come back undefined. Retry with backoff until we get a valid state.
  chrome.runtime.sendMessage({ type: "ytlab:getState" }, (state) => {
    if (chrome.runtime.lastError || !state) {
      if (retries > 0) setTimeout(() => fetchState(retries - 1), 400);
      return;
    }
    applyAll(state);
  });
}
fetchState();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "ytlab:setState" && msg.state) {
    applyAll(msg.state);
  }
});

function handleNavigate() {
  // Re-fetch state on navigate in case the initial fetch raced with a cold
  // service worker. If we already have state, just trigger the inject path.
  if (!currentState || !currentState.sim) fetchState();
  onNavigate();
}
window.addEventListener("yt-navigate-finish", handleNavigate);
window.addEventListener("yt-page-data-updated", handleNavigate);

// Fallback URL watcher — yt-navigate-finish doesn't always fire on SPA nav
// in current YouTube builds, leaving the watch sidebar inject stuck waiting
// for a refresh. Detect pathname changes directly.
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    handleNavigate();
  }
}, 500);
