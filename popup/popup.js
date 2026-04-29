/* ── Popup JS — power toggle + inline simulator settings ── */

const btn = document.getElementById("toggle");
const helpBtn = document.getElementById("help-btn");
const helpPanel = document.getElementById("help-panel");
const helpClose = document.getElementById("help-close");

// Simulator elements
const simEnabled = document.getElementById("sim-enabled");
const simPanel = document.getElementById("sim-panel");
const simThumb = document.getElementById("sim-thumb");
const simThumbStatus = document.getElementById("sim-thumb-status");
const simThumbPreview = document.getElementById("sim-thumb-preview");
const simAvatar = document.getElementById("sim-avatar");
const simAvatarStatus = document.getElementById("sim-avatar-status");
const simAvatarPreview = document.getElementById("sim-avatar-preview");
const simTitle = document.getElementById("sim-title");
const simChannel = document.getElementById("sim-channel");
const simMeta = document.getElementById("sim-meta");
const simDescription = document.getElementById("sim-description");
const simDuration = document.getElementById("sim-duration");
const simHighlight = document.getElementById("sim-highlight");
const simSaveDefault = document.getElementById("sim-save-default");
const simResetDefault = document.getElementById("sim-reset-default");

let thumbnailDataUrl = "";
let avatarDataUrl = "";
let loading = true;

const MAX_BYTES = 100 * 1024 * 1024;

/* ── Render state ── */
function render(state) {
  if (!state) return;
  btn.classList.toggle("on", !!state.active);

  const sim = state.sim || {};
  simEnabled.checked = !!sim.enabled;
  simPanel.hidden = !sim.enabled;

  simTitle.value = sim.title || "";
  simChannel.value = sim.channel || "";
  simMeta.value = sim.meta || "";
  simDescription.value = sim.description || "";
  simDuration.value = sim.duration || "";
  simHighlight.checked = sim.highlight !== false;

  if (sim.thumbnail) {
    thumbnailDataUrl = sim.thumbnail;
    simThumbPreview.src = sim.thumbnail;
    simThumbStatus.textContent = "Saved thumbnail loaded";
  } else {
    thumbnailDataUrl = "";
  }

  if (sim.avatar) {
    avatarDataUrl = sim.avatar;
    simAvatarPreview.src = sim.avatar;
    simAvatarStatus.textContent = "Saved avatar loaded";
  } else {
    avatarDataUrl = "";
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
    enabled: simEnabled.checked,
    highlight: simHighlight.checked,
  };
}

/* ── Auto-save (debounced for text, immediate available for images) ── */
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
chrome.runtime.sendMessage({ type: "ytlab:getState" }, render);

/* ── Power toggle ── */
btn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "ytlab:toggle" }, render);
});

/* ── Simulator on/off slider ── */
simEnabled.addEventListener("change", () => {
  simPanel.hidden = !simEnabled.checked;
  autoSave();
});

/* ── Auto-save on any field change ── */
[simTitle, simChannel, simMeta, simDescription, simDuration].forEach((el) => {
  el.addEventListener("input", autoSave);
});
simHighlight.addEventListener("change", autoSave);

/* ── Enter to exit input (skip textarea where Enter = newline) ── */
[simTitle, simChannel, simMeta, simDuration].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
  });
});

/* ── File reader helper ── */
function readFile(file, onLoad, statusEl) {
  if (!file) return;
  if (file.size > MAX_BYTES) {
    statusEl.textContent = `Too large (${(file.size / 1048576).toFixed(1)} MB)`;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    onLoad(String(reader.result || ""));
    statusEl.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    // Save image immediately — debounced autoSave loses the upload if the
    // popup closes / page navigates within the 300ms window.
    saveNow();
  };
  reader.onerror = () => {
    statusEl.textContent = "Failed to read file";
  };
  reader.readAsDataURL(file);
}

simThumb.addEventListener("change", () => {
  const file = simThumb.files && simThumb.files[0];
  readFile(file, (data) => {
    thumbnailDataUrl = data;
    simThumbPreview.src = data;
  }, simThumbStatus);
});

simAvatar.addEventListener("change", () => {
  const file = simAvatar.files && simAvatar.files[0];
  readFile(file, (data) => {
    avatarDataUrl = data;
    simAvatarPreview.src = data;
  }, simAvatarStatus);
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

/* ── Help panel ── */
helpBtn.addEventListener("click", () => {
  helpPanel.hidden = false;
});

helpClose.addEventListener("click", () => {
  helpPanel.hidden = true;
});
