# Tab Out ? but cute

> *"Are you someone who is highkey more productive and committed when Tom Nook kept asking you for bells? Well, now you can be your own Tom Nook every day ¡X and manage your tabs better while you're at it, yes yes!"*

**Tab Out but cute** is a restyled Chrome new-tab extension that replaces your new tab page with an Animal Crossing-themed dashboard of everything you have open. Tabs are grouped by domain, you get a time-aware AC-villager greeting, live weather, and a built-in to-do list ¡X all with a cozy island aesthetic.

> **Chrome only.** This extension uses Chrome Manifest V3 APIs (`chrome.tabs`, `chrome.storage`, `chrome.runtime`) that are specific to Chromium-based browsers. It works in **Chrome** and **Microsoft Edge**. Firefox is not currently supported.

---

## ? Features

### ?? Tab management
- **See all your tabs at a glance** ¡X clean grid, grouped by domain, so you can finally face the chaos
- **Homepage grouping** ¡X Gmail, X, YouTube, LinkedIn, and GitHub homepages get their own card so they don't clutter your real work
- **Color-coded categories** ¡X jobs, school, social, dev, and more each get a distinct accent color
- **Close tabs with style** ¡X satisfying swoosh sound + confetti burst, because you earned it
- **Duplicate detection** ¡X flags pages you have open twice with one-click cleanup
- **Click any tab to jump to it** ¡X across windows, no new tab opened
- **Save for later** ¡X bookmark a tab to a checklist before closing it, so nothing slips through
- **Localhost grouping** ¡X shows port numbers so you can tell your vibe-coding projects apart
- **Expandable groups** ¡X first 8 tabs visible, "+N more" to expand

### ? Animal Crossing greetings
- **Time-aware greetings** ¡X "Good morning!", "Good afternoon!", "Good evening!", "Good night~"
- **Rotating Tom Nook dialogue** ¡X a different villager one-liner every hour ("Check your mailbox ¡X packages waiting, hm?" / "The shooting stars are lovely tonight, yes yes!")
- **Live weather** ¡X fetches real conditions from [Open-Meteo](https://open-meteo.com/) using your location and renders them in AC style ("?? 80% chance of rain! Grab that umbrella, yes yes!")

### ? To-Do (Eisenhower Matrix)
- **Four quadrants** ¡X Do, Schedule, Delegate, Cut ¡X so you can prioritize like Isabelle on a crunch day
- **Click any task row to check/uncheck** ¡X no tiny checkbox hunting required
- **Hover to delete** ¡X same X-button interaction as closing a tab
- **@ mention tabs** ¡X type `@` in the task input for an autofill dropdown of your open tab groups and individual tabs, so you can link tasks directly to what you have open
- **"enter to add" hint** ¡X because sometimes the UI just needs to tell you what to do

### ? Cozy extras
- **Ocean wave footer** with swimming capybaras, fish, coral, and a sailboat
- **Leaf cursor** ¡X the whole extension uses a custom finger cursor
- **100% local** ¡X your data never leaves your machine
- **No server, no npm, no account** ¡X pure Chrome extension

---

## ? Installation (Chrome / Edge)

### Option A ¡X Load from this repo (recommended)

**1. Download or clone this repo**

```bash
git clone https://github.com/zarazhangrui/tab-out.git
# or download the ZIP from GitHub ¡÷ Code ¡÷ Download ZIP
```

**2. Open your browser's extension page**

| Browser | URL to visit |
|---------|-------------|
| Chrome  | `chrome://extensions` |
| Edge    | `edge://extensions` |

**3. Enable Developer Mode**

Toggle **Developer mode** on (top-right corner of the extensions page).

**4. Load the extension**

1. Click **Load unpacked**
2. Navigate to the `extension/` folder inside the cloned/unzipped repo
3. Select that folder and click **Open**

**5. Open a new tab**

That's it ¡X Tom Nook is now watching over your tabs, hm hm!

> ? **Tip:** Pin the extension icon from the puzzle-piece menu so you can click it to open a new tab anytime.

---

### Option B ¡X Use a coding agent

Send your coding agent (Claude, Codex, Cursor, etc.) this repo URL and say **"install this Chrome extension"**:

```
https://github.com/zarazhangrui/tab-out
```

The agent will walk you through the steps. Takes about 1 minute.

---

### Keeping it updated

Since this is a local unpacked extension, updates don't happen automatically. To update:

```bash
git pull
```

Then go back to `chrome://extensions` and click the **? refresh icon** on the Tab Out card.

---

## ? Privacy

**Tab Out collects absolutely no data. Here's exactly what it can and cannot do:**

| Permission | Why it's needed | What it does NOT do |
|-----------|-----------------|---------------------|
| `tabs` | Read your open tab titles and URLs to build the dashboard | Never sends tab data anywhere |
| `storage` | Save your To-Do tasks and "Saved for later" tabs locally | Data stays in `chrome.storage.local` on your device only |
| `activeTab` | Switch focus to a tab when you click it | Cannot access tab content |
| `geolocation` | Fetch local weather from Open-Meteo | Your coordinates are sent only to [Open-Meteo](https://open-meteo.com/), a free, open-source weather API ¡X no account, no tracking |

**No analytics. No ads. No external servers beyond the weather API. No data is sold, shared, or stored remotely ¡X ever.**

Your to-do list and saved tabs live entirely in your browser's local storage. Uninstalling the extension removes all stored data.

---

## ? Credits

This project stands on the shoulders of some great work:

| What | Who |
|------|-----|
| **Tab Out** ¡X original extension concept, tab management logic, and architecture | [Zara](https://x.com/zarazhangrui) ¡P [github.com/zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out) |
| **Animal Crossing UI** ¡X design system, component library, and island aesthetic inspiration | [guokaigdg](https://github.com/guokaigdg) ¡P [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) |
| **Weather data** | [Open-Meteo](https://open-meteo.com/) ¡X free, open-source, no API key required |

> If you love the original Tab Out, go star [Zara's repo](https://github.com/zarazhangrui/tab-out). If you love the Animal Crossing aesthetic, go star [guokaigdg's component library](https://github.com/guokaigdg/animal-island-ui). They both deserve the bells, yes yes! ?

---

## ?? Tech stack

| What | How |
|------|-----|
| Extension runtime | Chrome Manifest V3 |
| Storage | `chrome.storage.local` |
| Sound | Web Audio API (synthesized, no audio files) |
| Animations | CSS transitions + JS confetti particles |
| Weather | [Open-Meteo API](https://open-meteo.com/) (free, no key) |
| Design | Animal Island UI by guokaigdg |
| Font | Nunito (Google Fonts) |

---

## License

MIT ¡X same as the original Tab Out.

Do whatever you want, but please keep the credits in place. Tom Nook believes in fair trade, hm!
