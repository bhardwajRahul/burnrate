# macOS Native App Installation

## Homebrew (recommended)

```bash
brew install pratik1235/burnrate/burnrate
```

This automatically downloads the correct DMG for your chip, installs the app, and clears quarantine.

## Manual Download

Download the DMG for your Mac from the [latest GitHub release](https://github.com/pratik1235/burnrate/releases/latest):

| Mac | File |
|-----|------|
| Apple Silicon (M1/M2/M3/M4) | `Burnrate_aarch64.dmg` |
| Intel | `Burnrate_x86_64.dmg` |

## Install

1. Open the downloaded `.dmg` file
2. Drag **Burnrate** into the **Applications** folder
3. Eject the DMG

## First Launch

Since the app is ad-hoc signed (not with an Apple Developer ID certificate), macOS Gatekeeper may show one of these messages:

- **"Burnrate is damaged and can't be opened"**
- **"Burnrate can't be opened because Apple cannot check it for malicious software"**

**Fix (recommended):** Open Terminal and run:

```bash
xattr -cr /Applications/Burnrate.app
```

Then open the app normally. This only needs to be done once.

**Alternative:** Right-click (or Control-click) on **Burnrate** in Applications, select **Open**, and click **Open** in the confirmation dialog.

## Usage

1. Launch **Burnrate** from Applications (or Spotlight)
2. The app starts a local server and opens a native window
3. Complete the setup wizard on first run
4. Upload your credit card statement PDFs or set up a watch folder

## Data Storage

Your data is stored in:

```
~/Library/Application Support/burnrate/
```

This includes the SQLite database and any uploaded statement files.

## Updating

1. Download the new `.dmg` from [GitHub Releases](https://github.com/pratik1235/burnrate/releases/latest)
2. Open the DMG and drag the new **Burnrate** to Applications, replacing the old version
3. Your data is preserved — it's stored separately from the app

## Uninstall

1. Drag **Burnrate** from Applications to Trash
2. Optionally remove your data:

```bash
rm -rf ~/Library/Application\ Support/burnrate
```

## Troubleshooting

### "Burnrate is damaged and can't be opened"

Run in Terminal:

```bash
xattr -cr /Applications/Burnrate.app
```

### Server doesn't start

Run from Terminal to see logs:

```bash
/Applications/Burnrate.app/Contents/MacOS/Burnrate
```

### Port conflict

The app uses port 8000. If it's in use, set a different port before launching:

```bash
BURNRATE_PORT=8080 open /Applications/Burnrate.app
```
