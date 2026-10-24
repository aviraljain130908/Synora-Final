# SYNORA

SYNORA turns messy spreadsheets and documents into evidence-backed answers. The current project keeps the existing browser-first ingestion and analysis engine, while adding the SYNORA introduction, landing experience, labelled demo workspace, role-aware query policy, high-contrast mode, and a repeatable security evaluation.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The introduction transitions into the landing page. Choose **Explore demo workspace**, then load and analyse the synthetic education dataset.

For a direct reproducible demo route, open `http://localhost:3000/?autostart=1`.

## Checks

```bash
npm run lint
npm test
npm run build
```

The repository includes deterministic tests for schema profiling, document retrieval, query planning, read-only SQL execution, role restrictions, and 30 adversarial security payloads. The exact `bun run lint` / `bun run test` commands require Bun to be installed; this environment used the equivalent npm scripts because Bun was not available on PATH.

## Runtime and honest limitations

- The core demo agent is deterministic and local-first. It executes queries against the in-browser AlaSQL sandbox and does not claim that a hosted model is running.
- Optional Gemini endpoints remain available for OCR, PDF extraction, and provider-assisted responses when `GEMINI_API_KEY` is configured.
- The deployed core agent must use an open-weight model with no more than 8 billion parameters. Configure a compatible provider through `AI_PROVIDER`, `RUNTIME_AGENT_MODEL`, and `OPEN_WEIGHT_MODEL_ENDPOINT`; do not commit credentials.
- Google, GitHub, and Microsoft use server-side OAuth redirects at `/auth/google`, `/auth/github`, and `/auth/microsoft`. Add provider credentials, `APP_URL`, and a long random `SESSION_SECRET` to the server environment. Microsoft may use `MICROSOFT_TENANT_ID=common` for multi-tenant sign-in or a tenant ID for single-tenant applications. Register these exact local callback URLs: `http://localhost:3000/auth/google/callback`, `http://localhost:3000/auth/github/callback`, and `http://localhost:3000/auth/microsoft/callback`. Production callback URLs use the same paths under `APP_URL`. The modal checks `/api/auth/health` and `/api/auth/providers` with a finite timeout; unavailable services show a retry action, and unconfigured providers remain disabled. OAuth state and PKCE verifier cookies are HTTP-only and short-lived. The demo workspace remains available without OAuth.

## Transition audio

The supplied transition asset is served from `public/audio/synora-intro-transition.mp3` and is used once during the intro-to-landing transition. It is stopped and reset before replay so repeated logo clicks cannot layer multiple copies. If a browser blocks autoplay, the visual transition still completes and the next valid interaction can unlock audio. UI audio can be muted or adjusted from the workspace navbar; those preferences persist locally.

## Demo sequence

1. Open the SYNORA intro and landing page.
2. Enter the labelled demo workspace and analyse the synthetic education files.
3. Ask: `Which schools had falling enrolment last year?`
4. Inspect the answer's evidence, SQL, result rows, and validation panel.
5. Ask a follow-up such as `Now only for 2023.` or `Exclude schools with missing values.`
6. Open the graph and data-quality views.
7. Switch between dark, light, and high-contrast themes.
8. Open Settings and switch between Admin, Analyst, and Viewer policies.
