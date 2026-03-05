# Docker Distribution

Burnrate ships a multi-stage Dockerfile that packages the React frontend and Python backend into a single image.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/pratik1235/burnrate.git
cd burnrate

# Build and run
docker compose up -d

# Open in browser
open http://localhost:8000
```

## Architecture

The build has two stages:

1. **Frontend builder** (Node 20 Alpine) — runs `npm ci` and `npm run build` to produce the static React bundle.
2. **Runtime** (Python 3.12 slim) — installs Python dependencies, copies backend code and the built frontend.

The resulting image is ~350 MB (uncompressed). At runtime, FastAPI serves both the API (`/api/*`) and the React SPA (`/`).

## Data Persistence

All application data (SQLite database, uploaded statements) lives under `/data` inside the container. A Docker **named volume** is mounted there so data survives container restarts and image updates.

```yaml
volumes:
  - burnrate_data:/data
```

To back up your data:

```bash
docker run --rm -v burnrate_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/burnrate-data.tar.gz -C /data .
```

## Watch Folder

To auto-import credit card statements from a host directory, bind-mount it into the container:

```yaml
services:
  burnrate:
    volumes:
      - burnrate_data:/data
      - /path/to/your/statements:/watch:ro
```

Then set the watch folder path to `/watch` in the Burnrate setup wizard.

> **Note:** On macOS with Docker Desktop, host filesystem events may not propagate reliably into the container. The initial scan at startup still catches all existing files.

## Docker Hub

To push to Docker Hub:

```bash
docker login
docker tag burnrate:latest yourusername/burnrate:latest
docker push yourusername/burnrate:latest
```

Users can then run:

```bash
docker run -d -p 8000:8000 -v burnrate_data:/data yourusername/burnrate:latest
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BURNRATE_DATA_DIR` | `/data` | Directory for SQLite DB and uploads |
| `BURNRATE_STATIC_DIR` | `/app/static` | Directory containing built React frontend |
| `BURNRATE_PORT` | `8000` | Port for the uvicorn server (set in CMD) |

## Health Check

The Dockerfile includes a built-in health check that pings `/api/settings` every 30 seconds. Check health with:

```bash
docker inspect --format='{{.State.Health.Status}}' <container_id>
```

## Updating

```bash
cd burnrate
git pull
docker compose build
docker compose up -d
```

Data is preserved across rebuilds because it lives in the named volume.
