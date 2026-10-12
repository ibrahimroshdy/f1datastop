/// <reference types="vite/client" />
// Env var typings live in src/env.d.ts

// Injected at build time via `define` in vite.config.ts
declare const __APP_VERSION__: string;
declare const __APP_SHA__: string; // full 40-char SHA, or "unknown"
declare const __APP_REPO_URL__: string; // https://github.com/<owner>/<repo>, or ""
declare const __APP_RELEASED__: boolean; // a GitHub release exists (or will) for this version
