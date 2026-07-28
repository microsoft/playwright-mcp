# Playwright MCP on Render

Deploy [Playwright MCP](https://github.com/microsoft/playwright-mcp) on Render in one click. Get a hosted, headless-Chromium [MCP](https://modelcontextprotocol.io) server your AI tools can drive over HTTP — no local browser install, no `npx` on every machine.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/render-examples/playwright-mcp-render)


https://github.com/user-attachments/assets/0f31c279-f2e0-431f-a854-50677bd800c5


## What it does

[Playwright MCP](https://github.com/microsoft/playwright-mcp) is a Model Context Protocol server that lets an LLM open a real browser, navigate, click, type, and read pages through structured accessibility snapshots (not screenshots). It normally runs locally via `npx @playwright/mcp`. This template runs it as a single Render web service instead, so any MCP client can connect to a shared HTTPS URL.

It's a **thin wrapper** over the official `mcr.microsoft.com/playwright/mcp` image (headless Chromium already baked in) — no source changes. The wrapper adds the flags Render needs (`--headless`, `--no-sandbox`, `--host 0.0.0.0`) plus an optional locked-down [demo mode](#demo-mode).

For the full tool list, config options, and client setup, see the [upstream README](https://github.com/microsoft/playwright-mcp).

## Architecture

One Render web service runs the official Playwright MCP image with a thin entrypoint wrapper. An MCP client speaks Streamable HTTP to `/mcp` over Render's TLS-terminating edge; the server drives a headless Chromium in the same container and returns accessibility snapshots.

```
┌─────────────┐   HTTPS /mcp    ┌────────────────────────────────────────────────┐
│  MCP client │ ──────────────► │ Render web service  (Docker, standard plan)    │
│ (Claude,    │  Streamable     │                                                │
│  Cursor, …) │ ◄────────────── │  render-entrypoint.sh                          │
└─────────────┘   snapshots     │    │ reads PORT, DEMO, RENDER_EXTERNAL_HOSTNAME│
                                │    ▼                                           │
                                │  node /app/cli.js  --headless --no-sandbox …   │
                                │    │                                           │
                                │    ▼                                           │
                                │  headless Chromium  (baked into base image)    │
                                └────────────────────────────────────────────────┘
```

**How a deploy is assembled:**

| File | Role |
|------|------|
| [`render.yaml`](./render.yaml) | Blueprint. Declares the single Docker web service, its plan/region, and the `PORT`/`DEMO` env vars. This is what the Deploy button reads. |
| [`Dockerfile.render`](./Dockerfile.render) | Thin wrapper over `mcr.microsoft.com/playwright/mcp` (headless Chromium pre-baked). Adds only the entrypoint — no browser download, no source build. |
| [`render-entrypoint.sh`](./render-entrypoint.sh) | PID 1. Reads `PORT` and `DEMO`, resolves the allowed-hosts value, then `exec`s `node /app/cli.js` with the right flags for the chosen mode. |
| [`.env.example`](./.env.example) | Documents the same knobs for running the container locally. |

**Key properties:**

- **Thin wrapper, no fork of the tool.** The Playwright MCP version is pinned by the base-image tag in `Dockerfile.render`; upgrades are a one-line tag bump (see [Rolling Playwright MCP](#rolling-playwright-mcp)).
- **Stateless.** No database, no disk, no secrets. Each request drives an ephemeral browser context; nothing persists between requests (unless you attach a [Disk](https://render.com/docs/disks) — see [Configuration](#configuration)).
- **Two startup profiles from one image.** The `DEMO` env var selects between the full server and a locked-down public demo entirely inside the entrypoint (see [Demo mode](#demo-mode)).

## Prerequisites

To deploy, you need:

- A [Render account](https://dashboard.render.com/register) — free to create; the service itself runs on the paid `standard` instance type (see [Deploy](#deploy)).
- A GitHub account, to fork this repo (the Deploy button reads `render.yaml` from a repo you own).

**No API keys, secrets, or third-party accounts are required.**

To also run it locally (optional — see [Run locally](#run-locally)):

- [Docker](https://docs.docker.com/get-started/get-docker/) with BuildKit (Docker Desktop 4.x+, or Docker Engine 23+). `Dockerfile.render` uses a `# syntax=` directive and `COPY --chmod`, both BuildKit features.
- An MCP client to point at it (e.g. [Claude Code](https://docs.claude.com/en/docs/claude-code), Cursor), or just `curl`.

You do **not** need Node.js, Playwright, or a local Chromium — the base image bakes all of that in.

## Deploy

1. Click **Deploy to Render** above (or fork this repo and create a new Blueprint from it).
2. Render reads [`render.yaml`](./render.yaml) and provisions one Docker web service (`playwright-mcp`) on the `standard` plan.
3. Wait for the deploy to go **live**. Your server is at `https://<your-service>.onrender.com/mcp`.

> **Plan sizing:** headless Chromium OOMs on the free/`starter` tier (512 MB), so the Blueprint defaults to `standard` (2 GB). Downgrade only if you've confirmed your workload fits in less.

## Using the app

Point any MCP client at your service's `/mcp` endpoint. For example, with Claude Code:

```bash
claude mcp add --transport http playwright https://<your-service>.onrender.com/mcp
```

Or add it to a client config directly:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "https://<your-service>.onrender.com/mcp"
    }
  }
}
```

Then ask your assistant to browse — e.g. *"Open example.com and give me the page title and the main heading."* It will call the Playwright MCP tools against your hosted browser and return the result.

## Run locally

Optional — the deploy path above needs none of this. Useful if you want to change `render-entrypoint.sh` and see the effect before pushing.

```bash
git clone https://github.com/render-examples/playwright-mcp-render.git
cd playwright-mcp-render
cp .env.example .env          # defaults work as-is; no secrets to fill in
docker build -f Dockerfile.render -t playwright-mcp-render .
docker run --rm --env-file .env -p 10000:10000 playwright-mcp-render
```

Once ready, the container prints `Listening on http://localhost:10000`. (The `[startup]` line above it prints an `https://` URL — that scheme is for the deployed service; locally, use `http`.) Verify the server with an MCP handshake:

```bash
curl -sS -X POST http://localhost:10000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

You should get back a `serverInfo` block naming `Playwright`. Point a client at `http://localhost:10000/mcp` the same way you would the deployed URL.

To exercise the locked-down profile instead, override the one var: `docker run --rm --env-file .env -e DEMO=true -p 10000:10000 playwright-mcp-render`.

> `--env-file .env` is a convenience, not a requirement: outside Render there's no `RENDER_EXTERNAL_HOSTNAME`, so the entrypoint already falls back to `PORT=10000` and `--allowed-hosts *`. The file just makes those defaults explicit and gives you one place to tweak them.

Prefer to skip Docker entirely? Upstream runs the same server directly: `npx @playwright/mcp@latest --port 10000` — note that resolves to whatever npm publishes, not the image tag this template pins. That path is also not what Render deploys, so verify changes in the container before you push.

## Configuration

Everything is set in [`render.yaml`](./render.yaml); [`.env.example`](./.env.example) documents the same knobs for running locally.

| Env var | Default | What it's for |
|---------|---------|---------------|
| `PORT` | `10000` | Port the MCP transport binds to; Render routes to it. |
| `DEMO` | `false` | See [Demo mode](#demo-mode). Off = full server. Plain value, not a secret. |

`.env.example` also lists `PLAYWRIGHT_MCP_HOST`, `PLAYWRIGHT_MCP_HEADLESS`, and `PLAYWRIGHT_MCP_NO_SANDBOX`. These matter only when you run the server **directly** (outside this image) — on Render, `render-entrypoint.sh` always passes the equivalent CLI flags, and CLI flags win, so setting them in the Render dashboard has no effect. The one exception is `PLAYWRIGHT_MCP_ALLOWED_HOSTS`, which the entrypoint does honor.

The entrypoint scopes the server's host check to your service's own `onrender.com` hostname automatically via Render's `RENDER_EXTERNAL_HOSTNAME`. **If you add a [custom domain](https://render.com/docs/custom-domains)**, requests to it will be rejected by the host check until you set `PLAYWRIGHT_MCP_ALLOWED_HOSTS` (comma-separated, e.g. `myapp.com,myapp.onrender.com`; `*` disables the check).

The browser session is **stateless and ephemeral** — no profile is persisted between requests. If you want a persistent Chromium profile (saved logins, cookies), attach a [Render Disk](https://render.com/docs/disks) and add `--user-data-dir <mount-path>` to `render-entrypoint.sh`.

## Security

**Playwright MCP has no built-in authentication in HTTP mode.** A Render web service is public by default, so anyone who learns the URL can drive your hosted browser (fetch arbitrary URLs, spend CPU/RAM). Before you rely on this:

- **Keep the URL private**, or put the service behind your own auth proxy / IP allow-list.
- Consider making it a [private service](https://render.com/docs/private-services) if only other Render services need it.
- If you expose it publicly, turn on [demo mode](#demo-mode) and add bot defense (e.g. Cloudflare / Turnstile) in front.

The host check is scoped to your own hostname automatically; the origin blocklists in demo mode are best-effort hardening, **not** a security boundary (per upstream, they don't cover redirects).

## Demo mode

`DEMO=true` turns the deployed service into a **public, locked-down demo** — use it only for a demo URL you host yourself and watch. **Forks default to `DEMO=false`** and get the full, all-capabilities server.

When on, the entrypoint ([`render-entrypoint.sh`](./render-entrypoint.sh)) starts Playwright MCP with:

| Lockdown | Flag | Why |
|----------|------|-----|
| Per-connection isolated sessions | `--isolated` | Profile kept in memory, never written to disk — nothing persists or leaks across visitors. |
| No shared context | *(default)* | Each connected client gets its own browser context; sessions don't cross. |
| Internal origins blocked | `--blocked-origins …` | Best-effort block of `localhost`, loopback, and cloud-metadata IPs. |
| Service workers off | `--block-service-workers` | Shrinks the abuse surface. |
| Tight timeouts | `--timeout-navigation 30000 --timeout-action 5000` | Caps how long a single request can tie up the browser. |
| No image payloads | `--image-responses omit` | Smaller, cheaper responses. |

**Limitations to know:** Playwright MCP has **no built-in per-IP rate limiting**, and `--blocked-origins` is not a hard security boundary. If you host a genuinely public demo, you are responsible for the operational floor from Render's demo-mode guidance:

- Put **bot defense** (Cloudflare / Turnstile / hCaptcha) in front of the URL.
- Add a **global concurrency cap** and watch Render metrics for traffic spikes.
- Keep a **kill switch** — suspend the service or flip `DEMO`/scale to zero if abused.
- Show a **"public demo — may reset, don't submit anything sensitive"** notice wherever you link it.

## Rolling Playwright MCP

Pinned to `v0.0.78` in **two** places — keep them in lockstep:

- `image` tag in [`Dockerfile.render`](./Dockerfile.render)
- the version comment in [`render.yaml`](./render.yaml)

To bump, change the tag in `Dockerfile.render`, commit, and redeploy. (`runtime: docker` images don't auto-deploy when a tag moves — a fresh deploy pulls the new base.)

---

Based on [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) · Deploys on [Render](https://render.com).
