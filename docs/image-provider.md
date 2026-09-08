# Image Generation Provider

`ImageGenerationProvider` is separate from the structured-JSON `AIProvider`: its output is binary media plus dimensions, usage and optional actual cost. The OpenAI adapter uses the installed SDK Images API with `gpt-image-2`; the mock returns deterministic PNG bytes without a key or paid call.

OpenAI generation requires `AI_IMAGE_ESTIMATED_COST_USD`. This explicit estimate is required because the SDK does not expose a guaranteed billed-dollar value for `gpt-image-2`; the engine refuses a paid call when pricing is unknown.
