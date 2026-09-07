# Legacy Client-Side AI

The existing application still contains Gemini client-side access. This was intentionally preserved during Phase 3.

Current legacy locations:

- `vite.config.ts` injects `GEMINI_API_KEY` into browser-build code through `process.env.GEMINI_API_KEY`.
- `index.html` imports `GoogleGenAI` and initializes it in browser code.
- `index.html` calls `ai.models.generateContent()` for analysis/content operations.
- `index.html` calls `ai.models.generateImages()` for image generation.

This pattern exposes provider access to the client boundary and should be migrated to an internal server API in a later phase. The new OpenAI infrastructure does not reuse it: OpenAI configuration, SDK calls, budget enforcement, provider routing, and telemetry all live in server/application modules that are not imported by the Vite frontend.

Do not remove the Gemini path until feature parity and a controlled migration plan exist.
