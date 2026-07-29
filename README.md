# Playwright MCP on Render

Deploy [Playwright MCP](https://github.com/microsoft/playwright-mcp) on Render in one click. Get a hosted, headless-Chromium [MCP](https://modelcontextprotocol.io) server your AI tools can drive over HTTP — no local browser install, no `npx` on every machine.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/render-examples/playwright-mcp-render)

https://github.com/user-attachments/assets/0f31c279-f2e0-431f-a854-50677bd800c5

## What it does

[Playwright MCP](https://github.com/microsoft/playwright-mcp) is a Model Context Protocol server that lets an LLM open a real browser, navigate, click, type, and read pages through structured accessibility snapshots (not screenshots). It normally runs locally via `npx @playwright/mcp`. This template runs it as a single Render web service instead, so any MCP client can connect to a shared HTTPS URL.

It's a **thin wrapper** over the official `mcr.microsoft.com/playwright/mcp` image (headless Chromium already baked in) — no source changes. The wrapper adds only the flags Render needs (`--headless`, `--no-sandbox`, `--host 0.0.0.0`, plus `--port` and `--allowed-hosts` from the environment).

> **Restrict access before you deploy.** Playwright MCP has no authentication in HTTP mode, and it ships an RCE-equivalent tool. Anyone who learns the URL can run code in your container. See [Security](#security).

For the full tool list, config options, and client setup, see the [upstream README](https://github.com/microsoft/playwright-mcp).

## Architecture

One Render web service runs the official Playwright MCP image with a thin entrypoint wrapper. An MCP client speaks Streamable HTTP to `/mcp` over Render's TLS-terminating edge; the server drives a headless Chromium in the same container and returns accessibility snapshots.

```
┌─────────────┐   HTTPS /mcp    ┌────────────────────────────────────────────────┐
│  MCP client │ ──────────────► │ Render web service  (Docker, standard plan)    │
│ (Claude,    │  Streamable     │                                                │
│  Cursor, …) │ ◄────────────── │  render-entrypoint.sh                          │
└─────────────┘   snapshots     │    │ reads PORT, RENDER_EXTERNAL_HOSTNAME      │
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
| [`render.yaml`](./render.yaml) | Blueprint. Declares the single Docker web service, its plan/region, and the `PORT` env var. This is what the Deploy button reads. |
| [`Dockerfile.render`](./Dockerfile.render) | Thin wrapper over `mcr.microsoft.com/playwright/mcp` (headless Chromium pre-baked). Adds only the entrypoint — no browser download, no source build. |
| [`render-entrypoint.sh`](./render-entrypoint.sh) | PID 1. Reads `PORT`, resolves the allowed-hosts value, then `exec`s `node /app/cli.js` with the flags Render needs. |
| [`.env.example`](./.env.example) | Documents the same knobs for running the container locally. |

**Key properties:**

- **Thin wrapper, no fork of the tool.** The Playwright MCP version is pinned by the base-image tag in `Dockerfile.render`; upgrades are a one-line tag bump (see [Rolling Playwright MCP](#rolling-playwright-mcp)).
- **No database, no disk, no secrets** to configure. The browser keeps upstream's default **persistent profile**, so logins carry across requests for the life of the instance — convenient for a server that's yours alone, which is what this template assumes (see [Configuration](#configuration)).
- **No authentication.** Playwright MCP has no auth in HTTP mode, so restricting who can reach the service is on you (see [Security](#security)).

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
4. **Restrict access to it** — that URL is public and unauthenticated, and reaching it is enough to run code in your container. See [Security](#security) for how to lock it down.

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

Then ask your assistant to browse — e.g. _"Open example.com and give me the page title and the main heading."_ It will call the Playwright MCP tools against your hosted browser and return the result.

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

> `--env-file .env` is a convenience, not a requirement: outside Render there's no `RENDER_EXTERNAL_HOSTNAME`, so the entrypoint already falls back to `PORT=10000` and `--allowed-hosts *`. The file just gives you one place to tweak them.

Prefer to skip Docker entirely? Upstream runs the same server directly: `npx @playwright/mcp@latest --port 10000` — note that resolves to whatever npm publishes, not the image tag this template pins. That path is also not what Render deploys, so verify changes in the container before you push.

## Configuration

Everything is set in [`render.yaml`](./render.yaml); [`.env.example`](./.env.example) documents the same knobs for running locally.

| Env var | Default | What it's for |
|---------|---------|---------------|
| `PORT` | `10000` | Port the MCP transport binds to; Render routes to it. |

`.env.example` also lists `PLAYWRIGHT_MCP_HOST`, `PLAYWRIGHT_MCP_HEADLESS`, and `PLAYWRIGHT_MCP_NO_SANDBOX`. These matter only when you run the server **directly** (outside this image) — on Render, `render-entrypoint.sh` always passes the equivalent CLI flags, and CLI flags win, so setting them in the Render dashboard has no effect. The one exception is `PLAYWRIGHT_MCP_ALLOWED_HOSTS`, which the entrypoint does honor.

The entrypoint scopes the server's host check to your service's own `onrender.com` hostname automatically via Render's `RENDER_EXTERNAL_HOSTNAME`. **If you add a [custom domain](https://render.com/docs/custom-domains)**, requests to it will be rejected by the host check until you set `PLAYWRIGHT_MCP_ALLOWED_HOSTS` (comma-separated, e.g. `myapp.com,myapp.onrender.com`; `*` disables the check).

### Browser profile state

The entrypoint passes no profile flags, so you get Playwright MCP's default: a **persistent profile** on the container's filesystem (`~/.cache/ms-playwright/mcp-*`). Two consequences worth knowing:

- **Logins survive between calls — usually what you want.** Authenticate once through the hosted browser and later sessions reuse the session. Every client pointed at the URL shares that one profile, so this assumes the service is yours (see [Security](#security)). No Disk is attached, so the profile is wiped on restart or redeploy.
- **Concurrent clients can conflict.** Upstream notes a persistent profile "can only be used by one browser instance at a time, so concurrent MCP clients sharing the same workspace will conflict" — so two editors on one URL may collide. Scaling past one instance also gives each instance its own profile.

To change either, edit `render-entrypoint.sh`:

| Want | Add |
|------|-----|
| A fresh in-memory profile per session, discarded on close | `--isolated` |
| A profile that survives redeploys (saved logins) | a [Render Disk](https://render.com/docs/disks) plus `--user-data-dir <mount-path>` |

## Security

**Playwright MCP has no authentication in HTTP mode, and the Blueprint deploys a public web service. It's on you to restrict access.**

This is not just about someone spending your CPU. Playwright MCP exposes `browser_run_code_unsafe`, described upstream as: _"Run a Playwright code snippet. Unsafe: executes arbitrary JavaScript in the Playwright server process and is RCE-equivalent."_ On the pinned version it is listed under **Core automation**, not one of the opt-in capabilities, and [`--caps`](https://github.com/microsoft/playwright-mcp/blob/v0.0.78/README.md#configuration) only enables _additional_ capabilities (`vision`, `pdf`, `devtools`) — so it cannot drop this tool, and no flag excludes individual tools. **Anyone who can reach the URL can run code in your container as the container user.**

Pick the option that matches how you'll connect:

- **Your MCP client runs on your own machine** (Claude Code, Cursor — the common case, and what [Using the app](#using-the-app) describes). You need the public URL, so shut the door on it: restrict the service's [inbound IP rules](https://render.com/docs/inbound-ip-rules) to your known addresses (Scale and Enterprise plans only) and/or put your own authenticating proxy in front.
- **Your MCP client is another Render service.** Change `type: web` to `type: pserv` in [`render.yaml`](./render.yaml) to make it a [private service](https://render.com/docs/private-services) — it gets no public URL at all, which is strictly safer. Note that it also gets no `RENDER_EXTERNAL_HOSTNAME`, so the host check falls back to `*` and the startup banner prints a `localhost` URL; reach it over the private network instead.

**If you can do neither**, understand what you're running: the URL is the only thing standing between the internet and code execution in your container. Treat it as a credential, don't publish it, keep an eye on the service's metrics and logs, and suspend or delete the service when you're done with it. That is a weak control, not a good one.

The host check the entrypoint sets up (see [Configuration](#configuration)) is a Host-header check against DNS rebinding — **not** access control. It does nothing to stop a direct request to your URL.

## Rolling Playwright MCP

The version is pinned in exactly one place: the base-image tag in [`Dockerfile.render`](./Dockerfile.render). To bump, change that tag, commit, and redeploy. (`runtime: docker` images don't auto-deploy when a tag moves — a fresh deploy pulls the new base.)

Then re-check the two claims in [Security](#security) against the new tag's upstream README: whether `browser_run_code_unsafe` is still a non-opt-in **Core automation** tool, and whether `--caps` still only _adds_ capabilities. Update that section's permalink to the new tag either way — it's the only other place a version literal appears, because a permalink has to carry one.

> **Not** a version to keep in sync: the `version` field in `package.json`. This repo is a fork of [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp), so that field is upstream's own npm release marker — and the deploy never uses it (`Dockerfile.render` copies only `render-entrypoint.sh`). Expect it to differ from the image tag; leave it alone.

---

Based on [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) · Deploys on [Render](https://render.com).
