# Writers Kit — Release Process

## Prerequisites

- Private key generated via `yarn tauri signer generate` (stored securely, never committed)
- Public key already embedded in `src-tauri/tauri.conf.json`

---

## Steps

### 1. Bump the version

Update the version in two places:

**`src-tauri/tauri.conf.json`**
```json
"version": "0.2.0"
```

**`src-tauri/Cargo.toml`**
```toml
version = "0.2.0"
```

---

### 2. Build with signing key

In your terminal, from the project root:

```bash
export TAURI_SIGNING_PRIVATE_KEY="<your full private key string>"
yarn tauri build
```

If you set a password when generating the key, also export:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<your password>"
```

> **Note:** The `export` only lasts for the current terminal session. You will need to re-run it each time you open a new terminal to build a release.

---

### 3. Find the build output

```
src-tauri/target/release/bundle/
  dmg/    Writers.Kit_0.2.0_aarch64.dmg           ← installer for manual downloads
  macos/  Writers.Kit_0.2.0_aarch64.app.tar.gz    ← what the auto-updater downloads
          Writers.Kit_0.2.0_aarch64.app.tar.gz.sig ← signature file
```

---

### 4. Create `latest.json`

Create this file manually. The `signature` value is the full text content of the `.sig` file — open it and copy everything inside.

```json
{
  "version": "0.2.0",
  "notes": "Brief description of what changed",
  "pub_date": "2025-05-07T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<contents of Writers.Kit_0.2.0_aarch64.app.tar.gz.sig>",
      "url": "https://github.com/sambaines/writers-kit/releases/download/v0.2.0/Writers.Kit_0.2.0_aarch64.app.tar.gz"
    }
  }
}
```

> If building for multiple platforms (Intel Mac, Windows, Linux), add an entry under `platforms` for each. Platform keys: `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`, `linux-x86_64`.

---

### 5. Create the GitHub Release

1. Go to `github.com/sambaines/writers-kit/releases/new`
2. Tag: `v0.2.0`
3. Title: `Writers Kit 0.2.0`
4. Upload the following files:
   - `Writers.Kit_0.2.0_aarch64.dmg` — for users downloading manually
   - `Writers.Kit_0.2.0_aarch64.app.tar.gz` — for the auto-updater
   - `latest.json` — **must be named exactly `latest.json`**, the updater fetches this to check for new versions
5. Publish the release

---

## How the auto-updater works

On launch, the app fetches:
```
https://github.com/sambaines/writers-kit/releases/latest/download/latest.json
```

If the version in that file is newer than the running app, an update banner appears at the top of the window. The user clicks "Install & restart", the app downloads the `.app.tar.gz`, verifies the signature against the embedded public key, installs it, and relaunches.

---

## Private key storage reminder

- **Never commit** the private key to git
- Store it in a password manager or secure note
- The `.gitignore` already excludes `.env` files — if you store the key in `.env`, it will not be committed
- The public key in `tauri.conf.json` is safe to commit — it can only verify updates, not sign them
