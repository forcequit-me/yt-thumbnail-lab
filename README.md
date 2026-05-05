# YT Thumbnail Lab

A browser extension that turns every YouTube thumbnail grayscale. Includes a built-in simulator for previewing your own thumbnail inside the real YouTube UI.

## Why

Color does most of the attention-grabbing work in a thumbnail. Red arrows. Yellow highlights. Saturated skin tones. Take the color out and you see what's left: composition, typography, framing, contrast, subject. That part decides whether a thumbnail works.

Three uses:

- **Thumbnail analysis.** Auditing your channel or a competitor's is easier when color isn't covering weak composition.
- **A calmer feed.** The homepage stops shouting. You can browse without the constant pull.
- **Design study.** You learn faster from thumbnails without color than from an hour of scrolling.

## Features

- **Thumbnail Simulator.** Upload your thumbnail and avatar, fill in title, channel, view count, duration, and description. The extension drops a fake video card into the home feed, search results, and watch-page sidebar so you can preview against live cards.
- **Custom highlight color.** Pick any color for the outline around your simulated card.
- **Position controls.** Move the simulated card up, down, left, or right per page (home, search, watch sidebar). Defaults to centered.
- **Templates for A/B testing.** Save multiple named configurations (different thumbnails, titles, etc.), switch between them, and delete with confirmation.
- **Quick-slot default.** Save your usual setup and reload it with one click.
- **B&W mode.** Toggle every YouTube thumbnail to grayscale. Keyboard shortcut: `Alt+Shift+B`. Right-click any YouTube page for a toggle menu entry.
- Auto-saves as you type. Settings stay on your machine. No tracking. No network requests.

## Installation

The extension is not on the Chrome Web Store yet. You install it by loading the folder directly. Same steps in every Chromium browser: Chrome, Opera, Brave, Edge, Vivaldi, Arc.

1. Download this repository as a ZIP from GitHub (green **Code** button, then **Download ZIP**), or `git clone` it.
2. Extract the ZIP somewhere you won't move or delete. The folder with `manifest.json` inside is the one to point the browser at.
3. Open your browser's extensions page:
   - Chrome, Brave, Vivaldi: `chrome://extensions`
   - Opera: `opera://extensions`
   - Edge: `edge://extensions`
   - Arc: `arc://extensions`
4. Turn on **Developer mode** (top-right toggle in most browsers, left sidebar in Opera).
5. Click **Load unpacked**.
6. Select the extracted folder. Pick the one that contains `manifest.json`, not a parent or a subfolder.
7. The icon shows up in your extensions list and toolbar. If you don't see it in the toolbar, click the puzzle-piece icon and pin it.

To update later, replace your folder with the latest version and click the refresh icon on the extension's card.

To remove, click **Remove** on the extension's card.

## Usage

### The Simulator

Open the popup. Click the **power button** to turn the simulator on. The settings panel expands.

| Field | Notes |
|---|---|
| Highlight | Toggle the outline on/off. The color picker next to it sets the outline color. |
| Thumbnail | PNG or JPG. |
| Channel avatar | Optional. Replaces the avatar on the simulated card. |
| Title | Up to 100 characters. |
| Channel | Up to 50 characters. |
| Duration | e.g. `10:24` or `1:49:42`. |
| Views · Age | One line, e.g. `1.2M views • 3 days ago`. |
| Description | Up to 300 characters. Shows on the search results page only. |

Click the power button again to remove the card. Clicking the simulated card does nothing — it is a preview, not a real video.

### Position

The simulated card lands in the middle slot by default on each page. Open **Position** in the popup to nudge it:

- Three rows: **Home**, **Search**, **Watch** (sidebar).
- Four arrows per row: ▲ ▼ ◀ ▶. The readout shows the current `x,y` offset from center.
- On the home grid, ◀▶ moves one column and ▲▼ moves one row. On search and watch (linear lists), ◀▶ has no effect — only ▲▼.
- **Center all** resets every page to `0,0`.

### Templates (A/B testing)

Open **Templates** in the popup to save multiple named configurations:

- Type a name and click **Save** to store the current card content (thumbnail, avatar, title, channel, duration, views/age, description), the highlight on/off toggle, and the position offsets.
- Pick a name from the dropdown and click **Load** to swap to it.
- **Delete** removes the selected template. Confirmation required.
- Saving over an existing name asks for confirmation first.

Templates **do not** carry the highlight color — that is a global preference (see below).

### Quick-slot default

At the bottom of the simulator panel:

- **Save default.** Stores card content only (thumbnail, avatar, title, channel, duration, views/age, description). Excludes position, highlight toggle, and highlight color — so loading the default doesn't disturb your layout or color preference.
- **Reset.** Restores those content fields. Position offsets and highlight color stay where you have them. Useful when you want a clean starting point to build a new template variant.

If you haven't saved a default yet, **Reset** does nothing.

### Highlight color (global preference)

The color picker on the Highlight row auto-saves whenever you change it. It is **not** stored inside templates or the default — pick it once and it stays across every load.

### B&W mode

The **B&W** slider in the popup turns every YouTube thumbnail grayscale. Independent from the simulator — you can use either or both. Three ways to toggle:

- Click the popup's B&W slider.
- Right-click any YouTube page and pick **YT Thumbnail Lab: turn off / turn on**.
- Press `Alt+Shift+B` on any YouTube page.

The toolbar icon is dark when B&W is off, green when on.

## Troubleshooting

**Thumbnails aren't grayscale, or the simulator card isn't showing up.** YouTube loads pages incrementally and sometimes serves the page from cache before the extension starts. Refresh the page once or twice. On the watch page, give the recommended-videos sidebar a few seconds to load before the card appears.

**The toolbar icon doesn't change color when you toggle.** Restart the browser once after installing. Chrome can cache the icon until the extension's service worker fully starts.

**Nothing works at all.** Confirm the extension is enabled on the extensions page and that you're signed into YouTube. The extension does not run on `music.youtube.com`, YouTube Kids, YouTube TV, or embedded players on other sites. That is intentional.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your toggle state and simulator settings. |
| `unlimitedStorage` | So large thumbnail uploads don't hit the default 10 MB quota. |
| `contextMenus` | Adds the right-click toggle. |
| `*://*.youtube.com/*` | Run the extension on YouTube only. |

No other domains. No network access. Nothing leaves your machine.

## Browser support

| Browser | Status |
|---|---|
| Chrome, Opera, Brave, Edge, Vivaldi, Arc | Works. Load unpacked. |
| Firefox | Not yet. |
| Safari | Not planned. |

## License

MIT. See [LICENSE](LICENSE).
