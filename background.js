const DEFAULT_POSITION = {
  home:   { x: 0, y: 0 },
  search: { x: 0, y: 0 },
  watch:  { x: 0, y: 0 },
};

const DEFAULT_SIM = {
  enabled: false,
  thumbnail: "",
  avatar: "",
  title: "",
  channel: "",
  meta: "123K views • 2 hours ago",
  description: "",
  duration: "10:24",
  highlight: true,
  highlightColor: "#00ff88",
  position: DEFAULT_POSITION,
};

const DEFAULT_STATE = {
  active: false,
  sim: DEFAULT_SIM,
};

const MENU_ID = "ytlab-toggle";
const MENU_SIM_ID = "ytlab-sim-toggle";

function iconPaths(active) {
  const suffix = active ? "-on" : "";
  return {
    16: `icons/icon-16${suffix}.png`,
    48: `icons/icon-48${suffix}.png`,
    128: `icons/icon-128${suffix}.png`,
  };
}

async function updateIcon(active) {
  try {
    await chrome.action.setIcon({ path: iconPaths(active) });
  } catch (e) {}
}

async function updateMenu(active) {
  try {
    await chrome.contextMenus.update(MENU_ID, {
      title: active ? "YT Thumbnail Lab: B\u0026W off" : "YT Thumbnail Lab: B\u0026W on",
    });
  } catch (e) {}
}

async function updateMenuSim(simEnabled) {
  try {
    await chrome.contextMenus.update(MENU_SIM_ID, {
      title: simEnabled ? "YT Thumbnail Lab: Simulator off" : "YT Thumbnail Lab: Simulator on",
    });
  } catch (e) {}
}

async function broadcastState(state) {
  const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    chrome.tabs
      .sendMessage(tab.id, { type: "ytlab:setState", state })
      .catch(() => {});
  }
}

async function broadcastSimPatch(sim) {
  const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    chrome.tabs
      .sendMessage(tab.id, { type: "ytlab:patchSim", sim })
      .catch(() => {});
  }
}

function mergeSim(stored) {
  const s = stored || {};
  const pos = s.position || {};
  return {
    ...DEFAULT_SIM,
    ...s,
    position: {
      home:   { ...DEFAULT_POSITION.home,   ...(pos.home   || {}) },
      search: { ...DEFAULT_POSITION.search, ...(pos.search || {}) },
      watch:  { ...DEFAULT_POSITION.watch,  ...(pos.watch  || {}) },
    },
  };
}

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    active: !!stored.active,
    sim: mergeSim(stored.sim),
  };
}

async function setActive(active) {
  await chrome.storage.local.set({ active });
  const state = await getState();
  await updateIcon(state.sim.enabled);
  await updateMenu(state.active);
  await broadcastState(state);
}

async function setSim(sim) {
  const current = await getState();
  const merged = mergeSim({ ...current.sim, ...sim });
  await chrome.storage.local.set({ sim: merged });
  const state = await getState();
  await updateIcon(state.sim.enabled);
  await updateMenuSim(state.sim.enabled);
  const assetChanged =
    Object.prototype.hasOwnProperty.call(sim, "thumbnail") ||
    Object.prototype.hasOwnProperty.call(sim, "avatar");
  if (assetChanged) await broadcastState(state);
  else await broadcastSimPatch(sim);
}

// Fields stored in Save default — card content only. Excludes: enabled,
// position (per-test layout), highlight bool, highlightColor (global pref).
const DEFAULT_FIELDS = ["thumbnail", "avatar", "title", "channel", "meta", "description", "duration"];
// Fields stored in templates — content + highlight on/off + position.
// Excludes: enabled, highlightColor (global pref auto-saved on color change).
const TEMPLATE_FIELDS = [...DEFAULT_FIELDS, "highlight", "position"];

function pickFields(sim, fields) {
  const out = {};
  for (const k of fields) if (k in sim) out[k] = sim[k];
  return out;
}

async function saveDefault(sim) {
  await chrome.storage.local.set({ simDefault: pickFields(sim || {}, DEFAULT_FIELDS) });
}

async function resetDefault() {
  const { simDefault } = await chrome.storage.local.get({ simDefault: null });
  if (!simDefault) return;
  const current = await getState();
  const merged = mergeSim({ ...current.sim, ...pickFields(simDefault, DEFAULT_FIELDS) });
  await chrome.storage.local.set({ sim: merged });
  await broadcastState(await getState());
}

async function listTemplates() {
  const { simTemplates } = await chrome.storage.local.get({ simTemplates: {} });
  return Object.keys(simTemplates || {}).sort();
}

async function saveTemplate(name, sim) {
  if (!name) return;
  const { simTemplates } = await chrome.storage.local.get({ simTemplates: {} });
  simTemplates[name] = pickFields(sim || {}, TEMPLATE_FIELDS);
  await chrome.storage.local.set({ simTemplates });
}

async function loadTemplate(name) {
  const { simTemplates } = await chrome.storage.local.get({ simTemplates: {} });
  const tpl = simTemplates && simTemplates[name];
  if (!tpl) return;
  const current = await getState();
  const merged = mergeSim({ ...current.sim, ...pickFields(tpl, TEMPLATE_FIELDS) });
  await chrome.storage.local.set({ sim: merged });
  await broadcastState(await getState());
}

async function deleteTemplate(name) {
  const { simTemplates } = await chrome.storage.local.get({ simTemplates: {} });
  if (simTemplates && simTemplates[name]) {
    delete simTemplates[name];
    await chrome.storage.local.set({ simTemplates });
  }
}

async function toggle() {
  const { active } = await getState();
  await setActive(!active);
}

async function toggleSim() {
  const state = await getState();
  const next = !state.sim.enabled;
  const merged = mergeSim({ ...state.sim, enabled: next });
  await chrome.storage.local.set({ sim: merged });
  const newState = await getState();
  await updateIcon(newState.sim.enabled);
  await updateMenuSim(newState.sim.enabled);
  await broadcastState(newState);
}

async function ensureMenu() {
  const state = await getState();
  try {
    await chrome.contextMenus.removeAll();
  } catch (e) {}
  chrome.contextMenus.create({
    id: MENU_ID,
    title: state.active ? "YT Thumbnail Lab: B\u0026W off" : "YT Thumbnail Lab: B\u0026W on",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.youtube.com/*"],
  });
  chrome.contextMenus.create({
    id: MENU_SIM_ID,
    title: state.sim.enabled ? "YT Thumbnail Lab: Simulator off" : "YT Thumbnail Lab: Simulator on",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.youtube.com/*"],
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await updateIcon(state.sim.enabled);
  await ensureMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await updateIcon(state.sim.enabled);
  await ensureMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) toggle();
  if (info.menuItemId === MENU_SIM_ID) toggleSim();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-ytlab") toggle();
  if (command === "toggle-sim") toggleSim();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "ytlab:toggle") {
    toggle().then(async () => sendResponse(await getState()));
    return true;
  }
  if (msg.type === "ytlab:getState") {
    getState().then((state) => sendResponse(state));
    return true;
  }
  if (msg.type === "ytlab:setActive") {
    setActive(!!msg.active).then(async () => sendResponse(await getState()));
    return true;
  }
  if (msg.type === "ytlab:setSim") {
    setSim(msg.sim || {}).then(async () => sendResponse(await getState()));
    return true;
  }
  if (msg.type === "ytlab:saveDefault") {
    saveDefault(msg.sim || {}).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "ytlab:resetDefault") {
    resetDefault().then(async () => sendResponse(await getState()));
    return true;
  }
  if (msg.type === "ytlab:listTemplates") {
    listTemplates().then((names) => sendResponse({ names }));
    return true;
  }
  if (msg.type === "ytlab:saveTemplate") {
    saveTemplate(msg.name, msg.sim || {}).then(async () => {
      const names = await listTemplates();
      sendResponse({ names });
    });
    return true;
  }
  if (msg.type === "ytlab:loadTemplate") {
    loadTemplate(msg.name).then(async () => sendResponse(await getState()));
    return true;
  }
  if (msg.type === "ytlab:deleteTemplate") {
    deleteTemplate(msg.name).then(async () => {
      const names = await listTemplates();
      sendResponse({ names });
    });
    return true;
  }
});
