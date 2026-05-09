/* ── Popup JS — power=sim toggle, B&W slider, highlight color, position, templates ── */

const btn = document.getElementById("toggle");
const helpBtn = document.getElementById("help-btn");
const helpPanel = document.getElementById("help-panel");
const helpClose = document.getElementById("help-close");

// B&W (grayscale) toggle — global active state
const bwEnabled = document.getElementById("bw-enabled");
const resetSimOnStartup = document.getElementById("reset-sim-on-startup");
const resetBwOnStartup = document.getElementById("reset-bw-on-startup");

// Simulator elements
const simPanel = document.getElementById("sim-panel");
const simThumb = document.getElementById("sim-thumb");
const simThumbPreview = document.getElementById("sim-thumb-preview");
const thumbSlot = document.getElementById("thumb-slot");
const thumbPickBtn = document.getElementById("thumb-pick-btn");
const thumbClearBtn = document.getElementById("thumb-clear-btn");
const simAvatar = document.getElementById("sim-avatar");
const simAvatarPreview = document.getElementById("sim-avatar-preview");
const avatarSlot = document.getElementById("avatar-slot");
const avatarPickBtn = document.getElementById("avatar-pick-btn");
const avatarClearBtn = document.getElementById("avatar-clear-btn");
const simTitle = document.getElementById("sim-title");
const simChannel = document.getElementById("sim-channel");
const simViewsNum  = document.getElementById("sim-views-num");
const simViewsUnit = document.getElementById("sim-views-unit");
const simAgeNum    = document.getElementById("sim-age-num");
const simAgeUnit   = document.getElementById("sim-age-unit");
const simDescription = document.getElementById("sim-description");
const simDuration = document.getElementById("sim-duration");
const simHighlightBtn = document.getElementById("sim-highlight-btn");
const simHighlightColor = document.getElementById("sim-highlight-color");

// Hidden backing state for highlight (driven by pill button)
let highlightActive = true;
const simSaveDefault = document.getElementById("sim-save-default");
const simResetDefault = document.getElementById("sim-reset-default");

const posBtns = document.querySelectorAll(".pos-btn");

const tplSelect = document.getElementById("tpl-select");
const tplLoad = document.getElementById("tpl-load");
const tplDelete = document.getElementById("tpl-delete");
const tplName = document.getElementById("tpl-name");
const tplSave = document.getElementById("tpl-save");

let thumbnailDataUrl = "";
let avatarDataUrl = "";
let loading = true;
let position = {
  home:   { x: 0, y: 0 },
  search: { x: 0, y: 0 },
  watch:  { x: 0, y: 0 },
};

const MAX_BYTES = 100 * 1024 * 1024;

/* ── Position UI ── */

/* ── Power button visual = sim.enabled ── */
function renderPowerVisual(simEnabled) {
  btn.classList.toggle("on", !!simEnabled);
}

/* ── Render state ── */
function render(state) {
  if (!state) return;
  bwEnabled.checked = !!state.active;
  resetSimOnStartup.checked = !!state.settings?.autoOffSimOnStartup;
  resetBwOnStartup.checked = !!state.settings?.autoOffBwOnStartup;

  const sim = state.sim || {};
  simPanel.hidden = !sim.enabled;
  renderPowerVisual(sim.enabled);

  simTitle.value = sim.title || "";
  simChannel.value = sim.channel || "";
  parseMeta(sim.meta || "");
  simDescription.value = sim.description || "";
  simDuration.value = sim.duration || "";
  highlightActive = sim.highlight !== false;
  simHighlightBtn.checked = highlightActive;
  simHighlightColor.value = sim.highlightColor || "#00ff88";

  position = {
    home:   { ...(sim.position?.home   || { x: 0, y: 0 }) },
    search: { ...(sim.position?.search || { x: 0, y: 0 }) },
    watch:  { ...(sim.position?.watch  || { x: 0, y: 0 }) },
  };

  if (sim.thumbnail) {
    thumbnailDataUrl = sim.thumbnail;
    setThumbLoaded(sim.thumbnail);
  } else {
    thumbnailDataUrl = "";
    clearThumbUI();
  }

  if (sim.avatar) {
    avatarDataUrl = sim.avatar;
    setAvatarLoaded(sim.avatar);
  } else {
    avatarDataUrl = "";
    clearAvatarUI();
  }

  loading = false;
}

/* ── Build current sim object ── */
function getSimObject({ includeAssets = true } = {}) {
  const sim = {
    title: simTitle.value.trim(),
    channel: simChannel.value.trim(),
    meta: composeMeta(),
    description: simDescription.value,
    duration: simDuration.value.trim(),
    enabled: btn.classList.contains("on"),
    highlight: highlightActive,
    highlightColor: simHighlightColor.value || "#00ff88",
    position,
  };
  if (includeAssets) {
    sim.thumbnail = thumbnailDataUrl;
    sim.avatar = avatarDataUrl;
  }
  return sim;
}

/* ── Views/Age compose + parse ── */
function composeMeta() {
  const vn = simViewsNum.value.trim();
  const vu = simViewsUnit.value;
  const an = simAgeNum.value.trim();
  const au = simAgeUnit.value;
  if (!vn && !an) return "";
  const views = vn
    ? `${vn}${vu} view${vn === "1" && !vu ? "" : "s"}`
    : "";
  const ageNum = parseInt(an, 10);
  const age = an ? `${ageNum} ${au}${ageNum === 1 ? "" : "s"} ago` : "";
  return [views, age].filter(Boolean).join(" • ");
}

function parseMeta(str) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([KMB]?)\s*views?\s*•\s*(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i.exec(str || "");
  if (m) {
    simViewsNum.value  = m[1];
    simViewsUnit.value = m[2].toUpperCase();
    simAgeNum.value    = m[3];
    simAgeUnit.value   = m[4].toLowerCase();
  } else {
    simViewsNum.value  = "";
    simViewsUnit.value = "M";
    simAgeNum.value    = "";
    simAgeUnit.value   = "day";
  }
}

/* ── Auto-save ── */
let saveTimer = null;
function autoSave() {
  if (loading) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.runtime.sendMessage({
      type: "ytlab:setSim",
      sim: getSimObject({ includeAssets: false }),
    });
  }, 300);
}
function saveNow() {
  if (loading) return;
  clearTimeout(saveTimer);
  chrome.runtime.sendMessage({ type: "ytlab:setSim", sim: getSimObject() });
}

/* ── Initial load ── */
chrome.runtime.sendMessage({ type: "ytlab:getState" }, (state) => {
  render(state);
  refreshTemplates();
});

/* ── Power button → sim on/off ── */
btn.addEventListener("click", () => {
  const next = !btn.classList.contains("on");
  renderPowerVisual(next);
  simPanel.hidden = !next;
  // setSim with enabled flipped — getSimObject reads from button class
  chrome.runtime.sendMessage(
    {
      type: "ytlab:setSim",
      sim: { ...getSimObject({ includeAssets: false }), enabled: next },
    },
    (state) => state && render(state)
  );
});

/* ── B&W slider → toggle global active ── */
bwEnabled.addEventListener("change", () => {
  chrome.runtime.sendMessage(
    { type: "ytlab:setActive", active: bwEnabled.checked },
    (state) => state && render(state)
  );
});

resetSimOnStartup.addEventListener("change", () => {
  chrome.runtime.sendMessage(
    { type: "ytlab:setStartupReset", which: "sim", value: resetSimOnStartup.checked },
    (state) => state && render(state)
  );
});

resetBwOnStartup.addEventListener("change", () => {
  chrome.runtime.sendMessage(
    { type: "ytlab:setStartupReset", which: "bw", value: resetBwOnStartup.checked },
    (state) => state && render(state)
  );
});

/* ── Auto-save on field changes ── */
[simTitle, simChannel, simDescription, simDuration].forEach((el) => {
  el.addEventListener("input", autoSave);
});
[simViewsNum, simAgeNum].forEach((el) => el.addEventListener("input", autoSave));
[simViewsUnit, simAgeUnit].forEach((el) => el.addEventListener("change", autoSave));
simHighlightBtn.addEventListener("change", () => {
  highlightActive = simHighlightBtn.checked;
  autoSave();
});
simHighlightColor.addEventListener("input", autoSave);

/* ── Enter to blur ── */
[simTitle, simChannel, simDuration, tplName].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
      if (el === tplName) saveCurrentTemplate();
    }
  });
});

/* ── Upload slot UI helpers ── */
function setThumbLoaded(dataUrl) {
  simThumbPreview.src = dataUrl;
  thumbSlot.classList.add("has-file");
  thumbClearBtn.hidden = false;
}
function clearThumbUI() {
  simThumbPreview.src = "";
  thumbSlot.classList.remove("has-file");
  thumbClearBtn.hidden = true;
  simThumb.value = "";
}
function setAvatarLoaded(dataUrl) {
  simAvatarPreview.src = dataUrl;
  avatarSlot.classList.add("has-file");
  avatarClearBtn.hidden = false;
}
function clearAvatarUI() {
  simAvatarPreview.src = "";
  avatarSlot.classList.remove("has-file");
  avatarClearBtn.hidden = true;
  simAvatar.value = "";
}

/* ── File reader ── */
function readFile(file, onLoaded) {
  if (!file) return;
  if (file.size > MAX_BYTES) return; // silently skip over-large files
  const reader = new FileReader();
  reader.onload = () => {
    onLoaded(String(reader.result || ""));
    saveNow();
  };
  reader.readAsDataURL(file);
}

/* ── Pick buttons → open file dialog ── */
thumbPickBtn.addEventListener("click", () => simThumb.click());
avatarPickBtn.addEventListener("click", () => simAvatar.click());

/* ── Clear buttons ── */
thumbClearBtn.addEventListener("click", () => {
  thumbnailDataUrl = "";
  clearThumbUI();
  saveNow();
});
avatarClearBtn.addEventListener("click", () => {
  avatarDataUrl = "";
  clearAvatarUI();
  saveNow();
});

simThumb.addEventListener("change", () => {
  const file = simThumb.files && simThumb.files[0];
  readFile(file, (data) => {
    thumbnailDataUrl = data;
    setThumbLoaded(data);
  });
});

simAvatar.addEventListener("change", () => {
  const file = simAvatar.files && simAvatar.files[0];
  readFile(file, (data) => {
    avatarDataUrl = data;
    setAvatarLoaded(data);
  });
});

/* ── Save / reset defaults ── */
simSaveDefault.addEventListener("click", () => {
  chrome.runtime.sendMessage(
    { type: "ytlab:saveDefault", sim: getSimObject() },
    () => {
      simSaveDefault.textContent = "Saved";
      setTimeout(() => (simSaveDefault.textContent = "Save default"), 1200);
    }
  );
});

simResetDefault.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "ytlab:resetDefault" }, (state) => {
    if (state) {
      loading = true;
      render(state);
      simResetDefault.textContent = "Loaded";
      setTimeout(() => (simResetDefault.textContent = "Reset"), 1200);
    }
  });
});

/* ── Position arrows ── */
const POS_LIMIT = 5;
posBtns.forEach((b) => {
  b.addEventListener("click", () => {
    const dir = b.getAttribute("data-dir");
    if (dir === "prev") {
      position.home.x = Math.max(-POS_LIMIT, position.home.x - 1);
      position.search.y = Math.max(-POS_LIMIT, position.search.y - 1);
      position.watch.y = Math.max(-POS_LIMIT, position.watch.y - 1);
    } else if (dir === "next") {
      position.home.x = Math.min(POS_LIMIT, position.home.x + 1);
      position.search.y = Math.min(POS_LIMIT, position.search.y + 1);
      position.watch.y = Math.min(POS_LIMIT, position.watch.y + 1);
    } else if (dir === "center") {
      position.home.x = 0; position.home.y = 0;
      position.search.x = 0; position.search.y = 0;
      position.watch.x = 0; position.watch.y = 0;
    }
    const ts = Date.now();
    position.home.ts = ts;
    position.search.ts = ts;
    position.watch.ts = ts;
    autoSave();
  });
});

/* ── Templates ── */
function refreshTemplates() {
  chrome.runtime.sendMessage({ type: "ytlab:listTemplates" }, (resp) => {
    const names = (resp && resp.names) || [];
    const current = tplSelect.value;
    tplSelect.innerHTML = '<option value="">— select —</option>';
    names.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      tplSelect.appendChild(opt);
    });
    if (names.includes(current)) tplSelect.value = current;
  });
}

function saveCurrentTemplate() {
  const name = tplName.value.trim();
  if (!name) return;
  // Overwrite confirm if exists
  const existing = Array.from(tplSelect.options).map((o) => o.value);
  if (existing.includes(name)) {
    if (!confirm(`Overwrite template "${name}"?`)) return;
  }
  chrome.runtime.sendMessage(
    { type: "ytlab:saveTemplate", name, sim: getSimObject() },
    (resp) => {
      tplName.value = "";
      tplSave.textContent = "Saved";
      setTimeout(() => (tplSave.textContent = "Save"), 1200);
      refreshTemplates();
      if (resp && resp.names && resp.names.includes(name)) {
        setTimeout(() => (tplSelect.value = name), 0);
      }
    }
  );
}

tplSave.addEventListener("click", saveCurrentTemplate);

tplLoad.addEventListener("click", () => {
  const name = tplSelect.value;
  if (!name) return;
  chrome.runtime.sendMessage({ type: "ytlab:loadTemplate", name }, (state) => {
    if (state) {
      loading = true;
      render(state);
      tplLoad.textContent = "Loaded";
      setTimeout(() => (tplLoad.textContent = "Load"), 1200);
    }
  });
});

tplDelete.addEventListener("click", () => {
  const name = tplSelect.value;
  if (!name) return;
  if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
  chrome.runtime.sendMessage({ type: "ytlab:deleteTemplate", name }, () => {
    refreshTemplates();
  });
});

/* ── Help panel ── */
helpBtn.addEventListener("click", () => {
  helpPanel.hidden = false;
  document.body.classList.add("help-open");
});

helpClose.addEventListener("click", () => {
  helpPanel.hidden = true;
  document.body.classList.remove("help-open");
});

/* ── External state sync (keyboard shortcut / right-click sim toggle) ── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "ytlab:setState" && msg.state) {
    loading = true;
    render(msg.state);
  }
});
