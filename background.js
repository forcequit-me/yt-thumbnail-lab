const DEFAULT_SIM = {
  enabled: false,
  thumbnail: "",
  avatar: "",
  title: "Your title goes here",
  channel: "Your Channel",
  meta: "123K views • 2 hours ago",
  description: "",
  duration: "10:24",
  highlight: true,
};

const DEFAULT_STATE = {
  active: true,
  sim: DEFAULT_SIM,
};

const MENU_ID = "ytlab-toggle";

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
      title: active ? "YT Thumbnail Lab: turn off" : "YT Thumbnail Lab: turn on",
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

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    active: !!stored.active,
    sim: { ...DEFAULT_SIM, ...(stored.sim || {}) },
  };
}

async function setActive(active) {
  await chrome.storage.local.set({ active });
  const state = await getState();
  await updateIcon(state.active);
  await updateMenu(state.active);
  await broadcastState(state);
}

async function setSim(sim) {
  const current = await getState();
  const merged = { ...current.sim, ...sim };
  await chrome.storage.local.set({ sim: merged });
  const state = await getState();
  await broadcastState(state);
}

async function saveDefault(sim) {
  // Strip "enabled" so re-enabling later doesn't auto-flip when reset
  const { enabled, ...rest } = sim || {};
  await chrome.storage.local.set({ simDefault: rest });
}

async function resetDefault() {
  const { simDefault } = await chrome.storage.local.get({ simDefault: null });
  if (!simDefault) return;
  const current = await getState();
  // Preserve current enabled flag so toggling state isn't lost
  const merged = { ...current.sim, ...simDefault, enabled: current.sim.enabled };
  await chrome.storage.local.set({ sim: merged });
  await broadcastState(await getState());
}

async function toggle() {
  const { active } = await getState();
  await setActive(!active);
}

async function ensureMenu() {
  const { active } = await getState();
  try {
    await chrome.contextMenus.removeAll();
  } catch (e) {}
  chrome.contextMenus.create({
    id: MENU_ID,
    title: active ? "YT Thumbnail Lab: turn off" : "YT Thumbnail Lab: turn on",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.youtube.com/*"],
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { active } = await getState();
  await updateIcon(active);
  await ensureMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  const { active } = await getState();
  await updateIcon(active);
  await ensureMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) toggle();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-ytlab") toggle();
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
});
