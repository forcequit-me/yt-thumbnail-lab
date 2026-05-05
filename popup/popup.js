/* ── Popup JS — power=sim toggle, B&W slider, highlight color, position, templates ── */

const btn = document.getElementById("toggle");
const helpBtn = document.getElementById("help-btn");
const helpPanel = document.getElementById("help-panel");
const helpClose = document.getElementById("help-close");

// B&W (grayscale) toggle — global active state
const bwEnabled = document.getElementById("bw-enabled");

// Simulator elements
const simPanel = document.getElementById("sim-panel");
const simThumb = document.getElementById("sim-thumb");
const simThumbPreview = document.getElementById("sim-thumb-preview");
const thumbSlot = document.getElementById("thumb-slot");
const thumbPickBtn = document.getElementById("thumb-pick-btn");
const thumbLabel = document.getElementById("thumb-label");
const thumbClearBtn = document.getElementById("thumb-clear-btn");
const simAvatar = document.getElementById("sim-avatar");
const simAvatarPreview = document.getElementById("sim-avatar-preview");
const avatarSlot = document.getElementById("avatar-slot");
const avatarPickBtn = document.getElementById("avatar-pick-btn");
const avatarLabel = document.getElementById("avatar-label");
const avatarClearBtn = document.getElementById("avatar-clear-btn");
const simTitle = document.getElementById("sim-title");
const simChannel = document.getElementById("sim-channel");
const simMeta = document.getElementById("sim-meta");
const simDescription = document.getElementById("sim-description");
const simDuration = document.getElementById("sim-duration");
const simHighlightBtn = document.getElementById("sim-highlight-btn");
const simHighlightColor = document.getElementById("sim-highlight-color");

// Hidden backing state for highlight (driven by pill button)
let highlightActive = true;
const simSaveDefault = document.getElementById("sim-save-default");
const simResetDefault = document.getElementById("sim-reset-default");

const posReset = document.getElementById("pos-reset");
const posReadouts = document.querySelectorAll(".pos-readout");
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
function renderPosition() {
  posReadouts.forEach((el) => {
    const page = el.getAttribute("data-readout");
    const p = position[page] || { x: 0, y: 0 };
    el.textContent = `${p.x},${p.y}`;
  });
}

/* ── Power button visual = sim.enabled ── */
function renderPowerVisual(simEnabled) {
  btn.classList.toggle("on", !!simEnabled);
}

/* ── Render state ── */
function render(state) {
  if (!state) return;
  bwEnabled.checked = !!state.active;

  const sim = state.sim || {};
  simPanel.hidden = !sim.enabled;
  renderPowerVisual(sim.enabled);

  simTitle.value = sim.title || "";
  simChannel.value = sim.channel || "";
  simMeta.value = sim.meta || "";
  simDescription.value = sim.description || "";
  simDuration.value = sim.duration || "";
  highlightActive = sim.highlight !== false;
  simHighlightBtn.setAttribute("aria-pressed", String(highlightActive));
  simHighlightColor.value = sim.highlightColor || "#00ff88";

  position = {
    home:   { ...(sim.position?.home   || { x: 0, y: 0 }) },
    search: { ...(sim.position?.search || { x: 0, y: 0 }) },
    watch:  { ...(sim.position?.watch  || { x: 0, y: 0 }) },
  };
  renderPosition();

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
function getSimObject() {
  return {
    thumbnail: thumbnailDataUrl,
    avatar: avatarDataUrl,
    title: simTitle.value.trim(),
    channel: simChannel.value.trim(),
    meta: simMeta.value.trim(),
    description: simDescription.value,
    duration: simDuration.value.trim(),
    enabled: btn.classList.contains("on"),
    highlight: highlightActive,
    highlightColor: simHighlightColor.value || "#00ff88",
    position,
  };
}

/* ── Auto-save ── */
let saveTimer = null;
function autoSave() {
  if (loading) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: "ytlab:setSim", sim: getSimObject() });
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
    { type: "ytlab:setSim", sim: { ...getSimObject(), enabled: next } },
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

/* ── Auto-save on field changes ── */
[simTitle, simChannel, simMeta, simDescription, simDuration].forEach((el) => {
  el.addEventListener("input", autoSave);
});
simHighlightBtn.addEventListener("click", () => {
  highlightActive = !highlightActive;
  simHighlightBtn.setAttribute("aria-pressed", String(highlightActive));
  autoSave();
});
simHighlightColor.addEventListener("input", autoSave);

/* ── Enter to blur ── */
[simTitle, simChannel, simMeta, simDuration, tplName].forEach((el) => {
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
  simThumbPreview.hidden = false;
  thumbSlot.classList.add("has-file");
  thumbLabel.textContent = "Thumbnail ✓";
  thumbClearBtn.hidden = false;
}
function clearThumbUI() {
  simThumbPreview.hidden = true;
  simThumbPreview.src = "";
  thumbSlot.classList.remove("has-file");
  thumbLabel.textContent = "Thumbnail";
  thumbClearBtn.hidden = true;
  simThumb.value = "";
}
function setAvatarLoaded(dataUrl) {
  simAvatarPreview.src = dataUrl;
  simAvatarPreview.hidden = false;
  avatarSlot.classList.add("has-file");
  avatarLabel.textContent = "Avatar ✓";
  avatarClearBtn.hidden = false;
}
function clearAvatarUI() {
  simAvatarPreview.hidden = true;
  simAvatarPreview.src = "";
  avatarSlot.classList.remove("has-file");
  avatarLabel.textContent = "Avatar";
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
    const row = b.closest(".pos-row");
    const page = row.getAttribute("data-page");
    const dir = b.getAttribute("data-dir");
    const p = position[page];
    if (dir === "up")    p.y = Math.max(-POS_LIMIT, p.y - 1);
    if (dir === "down")  p.y = Math.min( POS_LIMIT, p.y + 1);
    if (dir === "left")  p.x = Math.max(-POS_LIMIT, p.x - 1);
    if (dir === "right") p.x = Math.min( POS_LIMIT, p.x + 1);
    renderPosition();
    autoSave();
  });
});

posReset.addEventListener("click", () => {
  position = {
    home:   { x: 0, y: 0 },
    search: { x: 0, y: 0 },
    watch:  { x: 0, y: 0 },
  };
  renderPosition();
  autoSave();
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
});

helpClose.addEventListener("click", () => {
  helpPanel.hidden = true;
});

/* ── External state sync (keyboard shortcut / right-click sim toggle) ── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "ytlab:setState" && msg.state) {
    loading = true;
    render(msg.state);
  }
});
