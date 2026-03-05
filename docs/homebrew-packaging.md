# Homebrew Packaging & Distribution — How and Why

This document explains every decision and change made to package burnrate for distribution via Homebrew, from the code modifications to the formula itself.

---

## Table of Contents

1. [Architecture Before Packaging](#architecture-before-packaging)
2. [The Problem](#the-problem)
3. [What Changed and Why](#what-changed-and-why)
   - [Relative API URLs](#1-relative-api-urls)
   - [Vite Dev Proxy](#2-vite-dev-proxy)
   - [Configurable Data Directory](#3-configurable-data-directory)
   - [Flexible Static File Resolution](#4-flexible-static-file-resolution)
   - [TypeScript Build Fixes](#5-typescript-build-fixes)
4. [The Homebrew Tap Repository](#the-homebrew-tap-repository)
5. [The Formula — Line by Line](#the-formula--line-by-line)
6. [How the Installed App Runs](#how-the-installed-app-runs)
7. [Release Workflow](#release-workflow)
8. [User Installation Guide](#user-installation-guide)
9. [Updating the Formula for New Releases](#updating-the-formula-for-new-releases)

---

## Architecture Before Packaging

Burnrate is a two-process application:

- **Backend**: A FastAPI server (`backend/main.py`) running on port 8000, using SQLAlchemy with a local SQLite database (`backend/data/tuesday.db`). It processes credit card PDF statements via `pikepdf` and `pdfplumber`.
- **Frontend**: A React + TypeScript app built with Vite (`frontend-neopop/`), using the CRED NeoPOP design system.

During development, these run separately:
- Frontend: `npm run dev` on port 5173
- Backend: `uvicorn backend.main:app` on port 8000

The frontend made API calls to the backend using a hardcoded URL: `http://localhost:8000/api`.

The backend had a static file mount that could serve a pre-built frontend from `frontend/dist`, but this path was wrong — the actual frontend directory is `frontend-neopop/`, so the mount never activated.

---

## The Problem

For Homebrew distribution, the app must work as a single process: one command (`burnrate`) that starts the backend and serves the frontend on the same port. Several things blocked this:

1. The frontend hardcoded `http://localhost:8000/api` — this only works during development when frontend and backend are on different ports. When served from the same origin, it must be `/api`.
2. The static file mount path was wrong (`frontend/dist` instead of `frontend-neopop/dist`).
3. The SQLite database was stored at `backend/data/tuesday.db`, a path relative to the source code. In a Homebrew install, the source code lives in an immutable Cellar directory — the database must go somewhere writable and persistent.
4. Unused TypeScript imports caused `tsc -b` to fail during production builds.

---

## What Changed and Why

### 1. Relative API URLs

**Files changed**: `frontend-neopop/src/lib/api.ts`, `SetupForm.tsx`, `FilterModal.tsx`, `TransactionRow.tsx`, `CategoryDonut.tsx`

**Before**:
```typescript
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});
```

**After**:
```typescript
const api = axios.create({
  baseURL: '/api',
});
```

**Why**: When Homebrew installs burnrate, the backend serves both the API and the frontend on the same origin (`http://localhost:8000`). A relative URL (`/api`) resolves to whatever origin the page was loaded from. This is the standard pattern for single-origin deployments — it also future-proofs the app for Docker, reverse proxies, or any deployment where the hostname isn't `localhost`.

Six files had hardcoded URLs. Some used the centralized axios instance, but others used raw `fetch()` calls with the full URL. All were converted to relative paths.

### 2. Vite Dev Proxy

**File changed**: `frontend-neopop/vite.config.ts`

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

**Why**: Switching to relative URLs (`/api`) broke the development workflow. During development, the frontend runs on port 5173 and the backend on port 8000 — they're different origins. When the browser requests `/api/settings`, it hits port 5173, which has no API.

The Vite proxy fixes this: it intercepts any request starting with `/api` and forwards it to `http://localhost:8000`. The developer experience is unchanged — `npm run dev` works exactly as before.

### 3. Configurable Data Directory

**File changed**: `backend/models/database.py`

```python
_env_data_dir = os.environ.get("BURNRATE_DATA_DIR")
if _env_data_dir:
    DATA_DIR = Path(_env_data_dir).expanduser()
else:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
```

**Why**: Homebrew installs formulas into an immutable Cellar directory (e.g., `/opt/homebrew/Cellar/burnrate/1.0.0/`). The app's code and libraries live there. But the SQLite database is user data — it must be writable and must survive upgrades.

The `BURNRATE_DATA_DIR` environment variable lets the Homebrew launcher script redirect the database to `/opt/homebrew/var/burnrate/`, a directory that Homebrew preserves across formula upgrades and reinstalls.

When the env var is not set (i.e., during normal development), the original behavior is preserved — the database goes to `backend/data/`.

### 4. Flexible Static File Resolution

**File changed**: `backend/main.py`

```python
_static_candidates = [
    os.environ.get("BURNRATE_STATIC_DIR", ""),
    str(_project_root_for_static / "frontend-neopop" / "dist"),
    str(_project_root_for_static / "frontend" / "dist"),
]
for _candidate in _static_candidates:
    if _candidate and Path(_candidate).is_dir():
        app.mount("/", StaticFiles(directory=_candidate, html=True), name="static")
        break
```

**Why**: Three problems solved at once:

- **Fixed the wrong path**: The original code looked for `frontend/dist`, but the directory is `frontend-neopop/dist`. It now tries `frontend-neopop/dist` first.
- **Homebrew layout**: In a Homebrew install, the backend code and frontend build output are in different directories under `libexec/`. The `BURNRATE_STATIC_DIR` env var lets the launcher point to the exact location.
- **Backward compatibility**: The fallback chain means existing setups (if someone had a `frontend/dist`) still work.

### 5. TypeScript Build Fixes

**Files changed**: `FilterModal.tsx`, `SetupForm.tsx`

Removed unused imports (`InputField` from FilterModal, `VerticalSpacer` from SetupForm). These were harmless in development but caused `tsc -b` to fail with `TS6133` errors during production builds. The Homebrew formula runs `npm run build` (which calls `tsc -b && vite build`), so these had to be fixed.

---

## The Homebrew Tap Repository

**Repository**: [github.com/pratik1235/homebrew-burnrate](https://github.com/pratik1235/homebrew-burnrate)

A Homebrew "tap" is a GitHub repository that contains formula files. The naming convention matters:

- Repository name **must** start with `homebrew-` (e.g., `homebrew-burnrate`)
- This lets users type the short form: `brew tap pratik1235/burnrate`
- Homebrew automatically looks for `github.com/pratik1235/homebrew-burnrate`

The tap repo contains just one formula file: `Formula/burnrate.rb`.

Why a separate repo instead of putting the formula in the main burnrate repo? The short tap syntax. With the formula in the main repo, users would need `brew tap pratik1235/burnrate https://github.com/pratik1235/burnrate` (explicit URL). With the `homebrew-` named repo, it's just `brew tap pratik1235/burnrate`.

---

## The Formula — Line by Line

```ruby
class Burnrate < Formula
  include Language::Python::Virtualenv
```

`Language::Python::Virtualenv` is a Homebrew mixin that provides the `virtualenv_create` helper. It sets up an isolated Python environment in `libexec/` so burnrate's dependencies don't conflict with other Homebrew Python packages.

```ruby
  url "https://github.com/pratik1235/burnrate/archive/v1.0.0.tar.gz"
  sha256 "66fd3aa81bea44da82d292d6ed61706ff97a23c0f8563f3687172b7825f98ac6"
```

Homebrew downloads the source tarball from GitHub's auto-generated archive. The SHA256 is verified to ensure integrity. This URL format (`/archive/v1.0.0.tar.gz`) is shorter and avoids CDN caching issues compared to `/archive/refs/tags/v1.0.0.tar.gz`.

```ruby
  depends_on "python@3.13"
  depends_on "node" => :build
  depends_on "qpdf"
```

Three dependencies:
- **python@3.13**: Runtime dependency. Homebrew installs its own Python, isolated from the system Python.
- **node**: Build-only dependency (`:build`). Needed for `npm ci` and `npm run build` during installation but not at runtime. Homebrew may remove it later if nothing else needs it.
- **qpdf**: Runtime dependency. The `pikepdf` Python library is a wrapper around the `qpdf` C library. Without the `qpdf` headers available, `pikepdf` can't compile its C extensions.

```ruby
  resource "fastapi" do
    url "https://files.pythonhosted.org/packages/.../fastapi-0.115.0.tar.gz"
    sha256 "f93b4ca3..."
  end
  # ... 28 more resource stanzas for every transitive dependency ...
```

Every Python dependency (and their dependencies, recursively) must be declared as a `resource` stanza with a pinned PyPI sdist URL and SHA256 hash. This is a strict Homebrew requirement — Homebrew creates virtualenvs with `--without-pip`, so you cannot call `pip install` directly. Use `homebrew-pypi-poet` or `brew update-python-resources` to generate these stanzas.

```ruby
  def install
    venv = virtualenv_create(libexec, "python3.13")
    venv.pip_install resources
```

Creates a virtualenv at `libexec/` using Homebrew's Python 3.13, then installs all declared resource stanzas into it using Homebrew's internal pip mechanism.

```ruby
    cd "frontend-neopop" do
      system "npm", "ci", "--ignore-scripts"
      system "npm", "run", "build"
    end
```

Builds the frontend. `npm ci` does a clean install from the lockfile. `--ignore-scripts` skips post-install scripts from dependencies (a security best practice for build environments). `npm run build` runs `tsc -b && vite build`, producing optimized static files in `frontend-neopop/dist/`.

```ruby
    libexec.install Dir["backend"]
    libexec.install "requirements.txt"
    (libexec/"frontend-neopop"/"dist").mkpath
    cp_r Dir["frontend-neopop/dist/."], libexec/"frontend-neopop"/"dist"
```

Copies the backend source code and built frontend into `libexec/`. This is Homebrew's convention: `libexec/` holds internal files, `bin/` holds user-facing commands. The backend Python files go into `libexec/backend/`, the frontend build output goes into `libexec/frontend-neopop/dist/`.

```ruby
    (var/"burnrate").mkpath
```

Creates the data directory at `$(brew --prefix)/var/burnrate/`. This is where the SQLite database will live.

```ruby
    (bin/"burnrate").write <<~EOS
      #!/bin/bash
      export BURNRATE_DATA_DIR="#{var}/burnrate"
      export BURNRATE_STATIC_DIR="#{libexec}/frontend-neopop/dist"
      export PYTHONPATH="#{libexec}:$PYTHONPATH"
      exec "#{libexec}/bin/python" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 "$@"
    EOS
```

The launcher script. This is what users actually run when they type `burnrate`. It:
1. Sets `BURNRATE_DATA_DIR` so the database goes to the persistent `var/` directory
2. Sets `BURNRATE_STATIC_DIR` so the backend finds the built frontend
3. Sets `PYTHONPATH` so Python can find the `backend` package inside `libexec/`
4. Runs uvicorn on `127.0.0.1:8000` (localhost only — no network exposure)
5. Passes through any extra arguments (`"$@"`) so users can customize (e.g., `burnrate --port 9000`)

```ruby
  service do
    run [bin/"burnrate"]
    keep_alive true
    log_path var/"log/burnrate.log"
    error_log_path var/"log/burnrate-error.log"
  end
```

Defines a launchd service for `brew services`. Users can run `brew services start burnrate` to have it start on login and run in the background. Logs go to `var/log/`.

```ruby
  test do
    port = free_port
    fork do
      ENV["BURNRATE_DATA_DIR"] = testpath/".burnrate"
      ENV["BURNRATE_STATIC_DIR"] = ""
      ENV["PYTHONPATH"] = libexec.to_s
      exec libexec/"bin/python", "-m", "uvicorn", "backend.main:app",
           "--host", "127.0.0.1", "--port", port.to_s
    end
    sleep 3
    output = shell_output("curl -s http://127.0.0.1:#{port}/api/settings")
    assert_match "setup_complete", output
  end
```

Homebrew's test block. It starts the server on a random free port, waits 3 seconds, then checks that the `/api/settings` endpoint responds with JSON containing `setup_complete`. This runs during `brew test burnrate`.

---

## How the Installed App Runs

After `brew install burnrate`, the directory layout looks like this:

```
$(brew --prefix)/
├── bin/
│   └── burnrate                          # Launcher script (in PATH)
├── Cellar/burnrate/1.0.0/
│   ├── bin/burnrate -> ../../bin/burnrate
│   └── libexec/
│       ├── bin/python -> python3.13      # Virtualenv Python
│       ├── lib/python3.13/site-packages/ # All pip dependencies
│       ├── backend/                      # Backend source code
│       │   ├── main.py
│       │   ├── models/
│       │   ├── routers/
│       │   ├── services/
│       │   └── parsers/
│       └── frontend-neopop/
│           └── dist/                     # Built React app
│               ├── index.html
│               └── assets/
└── var/
    └── burnrate/
        └── tuesday.db                    # SQLite database (persistent)
```

When a user runs `burnrate`:
1. The shell script in `bin/` sets environment variables
2. Uvicorn starts the FastAPI app
3. FastAPI initializes the SQLite database in `var/burnrate/`
4. The static file mount serves the React frontend from `libexec/frontend-neopop/dist/`
5. The user opens `http://localhost:8000` in their browser
6. The browser loads the React app, which makes API calls to `/api/*` on the same origin

---

## Release Workflow

When you want to publish a new version:

1. **Make changes** in the `burnrate` repo and commit to `main`
2. **Tag the release**:
   ```bash
   git tag v1.1.0
   git push origin main --tags
   ```
3. **Create a GitHub release**:
   ```bash
   gh release create v1.1.0 --title "v1.1.0" --notes "What changed."
   ```
4. **Get the new SHA256**:
   ```bash
   curl -sL https://github.com/pratik1235/burnrate/archive/v1.1.0.tar.gz | shasum -a 256
   ```
5. **Update the formula** in `homebrew-burnrate`:
   ```ruby
   url "https://github.com/pratik1235/burnrate/archive/v1.1.0.tar.gz"
   sha256 "NEW_SHA_HERE"
   ```
6. **Commit and push** the formula change:
   ```bash
   cd homebrew-burnrate
   git add Formula/burnrate.rb
   git commit -m "update to v1.1.0"
   git push origin main
   ```

Users update with `brew update && brew upgrade burnrate`. Their data in `var/burnrate/` is preserved.

---

## User Installation Guide

### Install

```bash
brew tap pratik1235/burnrate
brew install burnrate
```

### Run

```bash
burnrate
# Open http://localhost:8000 in your browser
```

### Run as background service

```bash
brew services start burnrate    # Start on login
brew services stop burnrate     # Stop the service
brew services restart burnrate  # Restart
```

### Upgrade

```bash
brew update
brew upgrade burnrate
```

### Uninstall

```bash
brew uninstall burnrate
brew untap pratik1235/burnrate
# Optionally remove data:
rm -rf $(brew --prefix)/var/burnrate
```

---

## Updating the Formula for New Releases

For convenience, here is the exact sequence to cut a new release:

```bash
# In the burnrate repo
cd /path/to/burnrate
git tag vX.Y.Z
git push origin main --tags
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes here."

# Get the SHA
SHA=$(curl -sL "https://github.com/pratik1235/burnrate/archive/vX.Y.Z.tar.gz" | shasum -a 256 | cut -d' ' -f1)
echo "SHA256: $SHA"

# In the homebrew-burnrate repo
cd /path/to/homebrew-burnrate
# Update url and sha256 in Formula/burnrate.rb
git add Formula/burnrate.rb
git commit -m "update to vX.Y.Z"
git push origin main
```
