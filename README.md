# YT Thumbnail Lab

A browser extension that turns every YouTube thumbnail grayscale. Includes a built-in simulator for previewing your own thumbnail inside the real YouTube UI.

## Why

Color does most of the attention-grabbing work in a thumbnail. Red arrows. Yellow highlights. Saturated skin tones. Take the color out and you see what's left: composition, typography, framing, contrast, subject. That part decides whether a thumbnail works.

Three uses:

- **Thumbnail analysis.** Auditing your channel or a competitor's is easier when color isn't covering weak composition.
- **A calmer feed.** The homepage stops shouting. You can browse without the constant pull.
- **Design study.** You learn faster from thumbnails without color than from an hour of scrolling.

## Features

- Toggle every YouTube thumbnail to grayscale with one click.
- Right-click any YouTube page for a toggle menu entry.
- Keyboard shortcut: `Alt+Shift+B`.
- **Thumbnail Simulator.** Upload your thumbnail and avatar, fill in title, channel, view count, duration, and description. The extension drops a fake video card into the home feed, search results, and watch-page sidebar so you can preview against live cards.
- Save default values you can reset to with one click.
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

### Toggle on or off

Three ways:

- Click the toolbar icon and hit the power button.
- Right-click any YouTube page and pick **YT Thumbnail Lab: turn off / turn on**.
- Press `Alt+Shift+B` on any YouTube page.

The toolbar icon is dark when off, green when on.

### The Simulator

Open the popup. Flip the **Simulator** slider on. The settings panel expands.

| Field | Notes |
|---|---|
| Thumbnail | PNG or JPG. |
| Channel avatar | Optional. Replaces the avatar on the simulated card. |
| Title | Up to 100 characters. |
| Channel | Up to 50 characters. |
| Duration | e.g. `10:24` or `1:49:42`. |
| Views · Age | One line, e.g. `1.2M views • 3 days ago`. |
| Description | Up to 300 characters. Shows on the search results page only. |
| Highlight | Green outline around the simulated card. |

Where the simulated card lands:

- Home / feed: third slot of the grid.
- Search results: third result.
- Watch page sidebar: second recommendation.

Turn the slider off to remove the card. Clicking the card does nothing. It is a preview, not a real video.

### Save default / Reset

Two small buttons at the bottom of the simulator panel:

- **Save default.** Stores everything in the form (title, channel, thumbnail, avatar, etc.) as your default.
- **Reset.** Reloads your saved default. Useful when you want to test a different thumbnail and then return to your usual setup.

If you haven't saved a default yet, **Reset** does nothing.

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
