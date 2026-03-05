# macOS Native Application (Tauri)

Burnrate uses [Tauri v2](https://v2.tauri.app/) to create a native macOS application. Tauri wraps the app in a lightweight native webview (WKWebView on macOS) — no Chromium bundled — resulting in a small, fast, memory-efficient app.

## Why Tauri Over PyInstaller

| Aspect | Tauri | PyInstaller |
|--------|-------|-------------|
| App size | ~10-20 MB | ~100-200 MB |
| Memory usage | System webview (shared) | Full Python runtime |
| Startup time | Near-instant | 2-5 seconds |
| Native feel | Real `.app` with system webview | Wrapped script |
| Auto-update | Built-in updater plugin | Manual |

## Architecture

Tauri creates a native macOS `.app` that:

1. **Launches a sidecar** — the Python/FastAPI backend is compiled to a standalone binary with PyInstaller and bundled as a Tauri [sidecar](https://v2.tauri.app/develop/sidecar)
2. **Opens a webview** — the native window loads the React frontend from the sidecar's HTTP server (`localhost:8000`)
3. **Manages lifecycle** — when the window closes, the sidecar process is automatically terminated

```
┌────────────────────────────────────────────┐
│  Burnrate.app                              │
│  ┌──────────────────────────────────────┐  │
│  │  Tauri Shell (Rust)                  │  │
│  │  - Spawns Python sidecar             │  │
│  │  - Manages window lifecycle          │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌───────────────┐  │
│  │  WKWebView        │  │  Python       │  │
│  │  (React frontend) │←→│  (FastAPI)    │  │
│  │  from localhost    │  │  sidecar      │  │
│  └──────────────────┘  └───────────────┘  │
└────────────────────────────────────────────┘
```

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (via `rustup`)
- [Node.js 18+](https://nodejs.org/)
- Python 3.11+
- Xcode Command Line Tools: `xcode-select --install`

## Setup

### 1. Install Tauri CLI

```bash
npm install -g @tauri-apps/cli@latest
```

### 2. Initialize Tauri in the Project

```bash
cd burnrate
npm create tauri-app@latest -- --template vanilla-ts
```

This creates a `src-tauri/` directory with the Rust shell.

### 3. Build the Python Sidecar

Use PyInstaller to compile the FastAPI backend into a single executable:

```bash
cd backend
pip install pyinstaller

pyinstaller --name burnrate-server \
    --onefile \
    --hidden-import uvicorn.logging \
    --hidden-import uvicorn.loops \
    --hidden-import uvicorn.loops.auto \
    --hidden-import uvicorn.protocols \
    --hidden-import uvicorn.protocols.http \
    --hidden-import uvicorn.protocols.http.auto \
    --hidden-import uvicorn.protocols.websockets \
    --hidden-import uvicorn.protocols.websockets.auto \
    --hidden-import uvicorn.lifespan \
    --hidden-import uvicorn.lifespan.on \
    --hidden-import backend.parsers.hdfc \
    --hidden-import backend.parsers.icici \
    --hidden-import backend.parsers.axis \
    --hidden-import backend.parsers.federal \
    --hidden-import backend.parsers.indian_bank \
    --hidden-import backend.parsers.generic \
    --hidden-import backend.parsers.detector \
    --collect-all pdfplumber \
    main.py
```

Copy the resulting binary into Tauri's sidecar directory:

```bash
# Determine the Rust target triple
TRIPLE=$(rustc -vV | grep host | awk '{print $2}')
mkdir -p ../src-tauri/binaries
cp dist/burnrate-server "../src-tauri/binaries/burnrate-server-${TRIPLE}"
```

### 4. Configure Tauri

Edit `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "identifier": "com.burnrate.app",
    "icon": ["icons/icon.icns"]
  },
  "plugins": {
    "shell": {
      "sidecar": true,
      "scope": [
        {
          "name": "binaries/burnrate-server",
          "sidecar": true,
          "args": true
        }
      ]
    }
  }
}
```

### 5. Wire Up the Rust Shell

In `src-tauri/src/main.rs`, spawn the sidecar and open the webview:

```rust
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let sidecar = app.shell()
                .sidecar("burnrate-server")
                .expect("failed to find sidecar binary");

            let (_rx, _child) = sidecar.spawn()
                .expect("failed to spawn sidecar");

            // Wait for the server to start
            std::thread::sleep(std::time::Duration::from_secs(2));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Burnrate");
}
```

### 6. Point the Webview to localhost

In `src-tauri/tauri.conf.json`, set the window URL:

```json
{
  "app": {
    "windows": [
      {
        "title": "Burnrate",
        "width": 1280,
        "height": 800,
        "url": "http://localhost:8000"
      }
    ]
  }
}
```

## Building

```bash
cd burnrate

# Build the React frontend
cd frontend-neopop && npm ci && npm run build && cd ..

# Build the Python sidecar (see step 3 above)

# Build the Tauri app
cd src-tauri
cargo tauri build
```

Output:
- `src-tauri/target/release/bundle/macos/Burnrate.app`
- `src-tauri/target/release/bundle/dmg/Burnrate.dmg`

## Data Storage

When running as a native app, data is stored in platform-standard directories via `platformdirs`:

| Item | Location |
|---|---|
| Database | `~/Library/Application Support/burnrate/tuesday.db` |
| Uploads | `~/Library/Application Support/burnrate/uploads/` |

Override with the `BURNRATE_DATA_DIR` environment variable.

## Code Signing and Notarization

### Without Apple Developer ID (personal use)

```bash
codesign -s - --force --deep Burnrate.app
```

Recipients bypass Gatekeeper with: Right-click → Open, or `xattr -cr Burnrate.app`.

### With Apple Developer ID (distribution)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Sign: `codesign -s "Developer ID Application: Your Name" --deep Burnrate.app`
3. Notarize: `xcrun notarytool submit Burnrate.dmg --apple-id you@email.com --team-id TEAMID --password @keychain:AC_PASSWORD`

## Tauri Auto-Update (Optional)

Tauri has a built-in [updater plugin](https://v2.tauri.app/plugin/updater/) that checks for new versions and updates the app in-place. Configure it in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://github.com/pratik1235/burnrate/releases/latest/download/latest.json"],
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

## Troubleshooting

### "Burnrate is damaged and can't be opened"

```bash
xattr -cr /path/to/Burnrate.app
```

### Server doesn't start

Run from terminal to see logs:

```bash
/path/to/Burnrate.app/Contents/MacOS/Burnrate
```

### Port conflict

The sidecar binds to `localhost:8000`. If the port is in use, set `BURNRATE_PORT=8080` before launching.
