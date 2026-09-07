# Removed Legacy Client-Side AI

Gemini was removed in Phase 3.2. It is no longer a runtime provider, fallback, dependency, browser import, model label, environment variable, or client-side secret source.

The former text features now use the server boundary:

- Refine Copy → `POST /api/ai/refine-copy` → `refineCopy()` → `BudgetedAIExecutor` → OpenAI Responses API.
- Generate Design → `POST /api/ai/generate-design-spec` → `generateDesignSpec()` → `BudgetedAIExecutor` → OpenAI Responses API.

Logo generation is temporarily unavailable. The server-independent `ImageGenerationProvider` contract is ready for a future OpenAI image adapter, but no paid image call is triggered in this phase.

All AI credentials remain server-side. Historical browser key controls and browser storage access were removed.
