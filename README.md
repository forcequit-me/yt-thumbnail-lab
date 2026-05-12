# YT Thumbnail Lab

A browser extension that grayscales every YouTube thumbnail and lets you preview your own thumbnail inside the real YouTube UI.

## Why

Color carries most of the pull on a thumbnail. Remove it and you see the underlying composition, typography, framing, and contrast.

Three uses:

- **Audit your work.** Reviewing your channel or a competitor's gets clearer once color stops covering weak layouts.
- **Browse calmer.** A grayscale feed scrolls without engagement-baiting.
- **Study design.** You absorb thumbnail technique faster without the color noise.

## Features

- **Thumbnail simulator.** Upload your thumbnail and avatar, fill in title, channel, view count, duration, and description. A fake video card appears in the home feed, search results, and watch-page sidebar, side by side with live cards. Shortcut: `Alt+Shift+S`. Right-click any YouTube page for the toggle.
- **Custom highlight color.** Pick the outline color around your sim card.
- **Reposition the sim card.** A prev / Recenter / next bar shifts the card between adjacent video slots on home, search, and watch.
- **Templates for A/B testing.** Save named configurations (thumbnail, title, all the fields), swap between them, delete with confirmation.
- **Quick-slot default.** Save your usual setup and reload it with one click.
- **B&W mode.** Grayscales every thumbnail on YouTube. Shortcut: `Alt+Shift+B`. Right-click toggle as well. Off by default.
- Auto-saves as you type. Settings stay local. No tracking, no network calls.

## Installation

The extension is not on the Chrome Web Store yet. You install it by loading the folder directly. Same steps in every Chromium browser: Chrome, Opera, Brave, Edge, Vivaldi, Arc.

1. Download this repository as a ZIP from GitHub (green **Code** button, then **Download ZIP**), or `git clone` it.
2. Extract the ZIP somewhere you won't move or delete. The folder containing `manifest.json` is the one to point the browser at.
3. Open your browser's extensions page:
   - Chrome, Brave, Vivaldi: `chrome://extensions`
   - Opera: `opera://extensions`
   - Edge: `edge://extensions`
   - Arc: `arc://extensions`
4. Turn on **Developer mode** (top-right toggle in most browsers, left sidebar in Opera).
5. Click **Load unpacked**.
6. Select the extracted folder. Pick the one that contains `manifest.json`, not a parent or a subfolder.
7. The icon shows up in your extensions list and toolbar. If you don't see it in the toolbar, click the puzzle-piece icon and pin it.

To update later, replace your folder with the latest version and click the refresh icon on the extension's card. To remove, click **Remove** on the card.

## Usage

### The simulator

Open the popup. Click the **power button** to turn the simulator on. The settings panel expands.

| Field | Notes |
|---|---|
| Highlight | Toggle the outline on/off. The color picker next to it sets the outline color. |
| Thumbnail | PNG or JPG. |
| Channel avatar | Optional. Replaces the avatar on the sim card. |
| Title | Up to 100 characters. |
| Channel | Up to 50 characters. |
| Duration | e.g. `10:24` or `1:49:42`. |
| Views · Age | One line, e.g. `1.2M views • 3 days ago`. |
| Description | Up to 300 characters. Shows on the search results page only. |

Three ways to toggle the simulator:

- Click the **power button** in the popup.
- Right-click any YouTube page and pick **YT Thumbnail Lab: Simulator off / Simulator on**.
- Press `Alt+Shift+S` on any YouTube page.

Clicking the sim card does nothing. It's a preview, not a real video. The toolbar icon goes green when the simulator is on, dark when off.

### Position

Open **Position** in the popup. Three buttons: **<**, **Recenter**, **>**.

- **<** moves the sim card to the previous video slot on the page you're currently viewing.
- **>** moves it to the next slot.
- **Recenter** snaps the sim card to whichever video is closest to the middle of your screen right now.

Position lives on the page itself, not in storage. Reloading the tab or switching to a new search resets the sim to the center of the new view. If the sim has scrolled out of sight, the next arrow click pulls it back to your view before stepping.

### Templates (A/B testing)

Open **Templates** in the popup to save named configurations:

- Type a name and click **Save** to store the current card content (thumbnail, avatar, title, channel, duration, views/age, description) and the highlight on/off toggle.
- Pick a name from the dropdown and click **Load** to swap to it.
- **Delete** removes the selected template. Confirmation required.
- Saving over an existing name asks for confirmation first.

Templates do not carry the highlight color. It's a global preference (see below).

### Quick-slot default

At the bottom of the simulator panel:

- **Save default.** Stores card content only (thumbnail, avatar, title, channel, duration, views/age, description). Excludes the highlight toggle and highlight color, so loading the default leaves your color choices alone.
- **Reset.** Restores those content fields. Highlight color stays put. Use it when starting a new template variant from scratch.

If you haven't saved a default, **Reset** does nothing.

### Highlight color (global preference)

The color picker on the Highlight row auto-saves on change. Templates and the default don't carry it. Pick once, it persists across loads.

### B&W mode

The **B&W** slider in the popup grayscales every thumbnail on YouTube. It's independent from the simulator. Use either or both. Three toggles:

- Click the popup's B&W slider.
- Right-click any YouTube page and pick **YT Thumbnail Lab: B&W off / B&W on**.
- Press `Alt+Shift+B` on any YouTube page.

### Preferences (auto off on restart)

The gear icon in the top-left of the popup opens preferences. Two toggles, both off by default:

- **Simulator.** Turns the simulator off automatically when the browser starts.
- **B&W.** Turns B&W off automatically when the browser starts.

Useful if you only want these on during deliberate sessions. Close with the **×** in the corner or by pressing `Esc`.

## One tab at a time

The extension is built around a single active YouTube tab. Running the simulator or B&W on multiple YouTube tabs at once can cause the sim card to render inconsistently, duplicate, or fail to update when you switch between them. Keep YouTube open in one tab while you're using the extension. If you need a second tab, toggle the simulator off in the first one first.

## Troubleshooting

**Thumbnails aren't grayscale, or the sim card isn't showing.** YouTube loads pages incrementally and sometimes serves cached content before the extension starts. Refresh once or twice. The watch sidebar lazy-loads, so give it a few seconds.

**Sim card looks wrong or won't update across tabs.** See [One tab at a time](#one-tab-at-a-time). Close extra YouTube tabs and refresh the one you're using.

**The toolbar icon doesn't recolor on toggle.** Restart the browser once after install. Chrome caches the icon until the service worker boots.

**Nothing works at all.** Confirm the extension is enabled on the extensions page and you're signed into YouTube. The extension does not run on `music.youtube.com`, YouTube Kids, YouTube TV, or embedded players on other sites. By design.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your toggle state and simulator settings. |
| `unlimitedStorage` | So large thumbnail uploads don't hit the default 10 MB quota. |
| `contextMenus` | Adds the right-click toggle. |
| `*://*.youtube.com/*` | Run the extension on YouTube only. |

Restricted to youtube.com. The extension makes no network calls; nothing leaves your machine.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Opera, Brave, Edge, Vivaldi, Arc | Works. Load unpacked. |
| Firefox | Not yet. |
| Safari | Not planned. |

## License

MIT. See [LICENSE](LICENSE).
