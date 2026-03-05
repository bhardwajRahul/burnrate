# Windows Native Application

Burnrate can be packaged as a native Windows executable using PyInstaller and distributed with an Inno Setup installer.

## Prerequisites

- Python 3.11+ (from [python.org](https://www.python.org/downloads/))
- Node.js 18+ (from [nodejs.org](https://nodejs.org/))
- PyInstaller: `pip install pyinstaller`
- [Inno Setup](https://jrsoftware.org/isinfo.php) (optional, for creating an installer)

## Building

### Step 1: Build the Executable

```cmd
cd burnrate
scripts\build-windows.bat
```

This produces `dist\Burnrate\` — a portable folder containing `Burnrate.exe` and all dependencies.

### Step 2: Create Installer (Optional)

1. Install [Inno Setup](https://jrsoftware.org/isdl.php)
2. Open `scripts\burnrate.iss` in Inno Setup Compiler
3. Click Build → Compile
4. The installer is created at `dist\Burnrate-Setup.exe`

## What the Build Script Does

1. Builds the React frontend (`npm ci && npm run build`)
2. Bundles the Python backend, all dependencies, and the built frontend into a directory using PyInstaller
3. The resulting folder is self-contained — no Python or Node.js installation required on the target machine

## Data Storage

When running as a native app, Burnrate stores its data using platform-standard directories:

| Item | Location |
|---|---|
| Database | `%LOCALAPPDATA%\burnrate\Data\tuesday.db` |
| Uploads | `%LOCALAPPDATA%\burnrate\Data\uploads\` |

This is handled automatically by `platformdirs`. You can override with the `BURNRATE_DATA_DIR` environment variable.

## How It Works

1. **Launch:** Double-click `Burnrate.exe` (or use the Start Menu shortcut if installed)
2. **Server starts:** Uvicorn binds to `localhost:8000`
3. **Browser opens:** After a 2-second delay, the default browser opens `http://localhost:8000`
4. **Shutdown:** Close the command window or the system tray icon

## Distribution Options

### Portable (No Installer)

Zip the `dist\Burnrate\` folder and share it. Recipients extract and run `Burnrate.exe`.

### Installer (Recommended)

The Inno Setup installer (`Burnrate-Setup.exe`) provides:

- Start Menu shortcut
- Optional desktop shortcut
- Proper uninstall via "Add or Remove Programs"
- `{autopf}` installs to `Program Files` (per-user, no admin required)

## Windows Defender SmartScreen

Since the executable is not code-signed, Windows SmartScreen may show a warning:

> "Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."

Users can click "More info" → "Run anyway".

### Code Signing (Optional)

To avoid SmartScreen warnings, sign the executable with a code signing certificate:

```powershell
# Using signtool (from Windows SDK)
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 dist\Burnrate\Burnrate.exe
```

Code signing certificates cost ~$70-200/year from providers like DigiCert, Sectigo, or SSL.com.

## Troubleshooting

### Port already in use

Set a different port before launching:

```cmd
set BURNRATE_PORT=8080
Burnrate.exe
```

### Missing DLLs

If the app fails with missing DLL errors, install the [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

### Antivirus false positive

PyInstaller executables are occasionally flagged by antivirus software. If this happens:

1. Add an exception for `Burnrate.exe` in your antivirus settings
2. Or run from source: `python scripts/launch.py`
