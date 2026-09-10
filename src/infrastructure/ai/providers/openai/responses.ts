import { Buffer } from "node:buffer";
import OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { VisualInput } from "../../../../domain/visual-forensics/index.js";
import type {
  AIProvider,
  AIStructuredRequest,
  AIStructuredResponse,
} from "../../types.js";
import {
  AIAuthenticationError,
  AIProviderError,
  AIRateLimitError,
  AIResponseError,
  AITimeoutError,
  UnsupportedAIInputError,
} from "../errors.js";
import { createOpenAIClient } from "./client.js";
import type { OpenAIConfig } from "./config.js";
import { normalizeOpenAIUsage } from "./usage.js";

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);
const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const imageDataUrl = (input: VisualInput, maxMb: number): string => {
  if (input.kind === "url")
    throw new UnsupportedAIInputError(
      "Remote image URLs are not accepted; provide base64 or bytes to prevent SSRF.",
    );
  if (!ALLOWED_MEDIA.has(input.mediaType))
    throw new UnsupportedAIInputError(
      `Unsupported image media type: ${input.mediaType}.`,
    );
  const base64 =
    input.kind === "bytes"
      ? Buffer.from(input.data).toString("base64")
      : input.data.replace(/^data:[^;]+;base64,/, "");
  const estimatedBytes = Math.ceil(base64.length * 0.75);
  if (estimatedBytes > maxMb * 1024 * 1024)
    throw new UnsupportedAIInputError(
      `Image exceeds the ${maxMb} MB server limit.`,
    );
  return `data:${input.mediaType};base64,${base64}`;
};

const mapError = (error: unknown): AIProviderError => {
  if (error instanceof OpenAI.AuthenticationError)
    return new AIAuthenticationError("OpenAI authentication failed.", error);
  if (error instanceof OpenAI.RateLimitError)
    return new AIRateLimitError("OpenAI rate limit reached.", error);
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return new AITimeoutError("OpenAI request timed out.", error);
  if (error instanceof OpenAI.APIError)
    return new AIProviderError(
      `OpenAI request failed with status ${error.status ?? "unknown"}.`,
      error,
    );
  return new AIProviderError("OpenAI request failed.", error);
};
const retryable = (error: unknown): boolean =>
  error instanceof OpenAI.RateLimitError ||
  error instanceof OpenAI.APIConnectionTimeoutError ||
  error instanceof OpenAI.APIConnectionError ||
  (error instanceof OpenAI.APIError && TRANSIENT_STATUS.has(error.status ?? 0));

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  private readonly client: OpenAI;
  constructor(
    private readonly config: OpenAIConfig,
    client?: OpenAI,
  ) {
    this.client = client ?? createOpenAIClient(config);
  }

  async generateStructured<T>(
    request: AIStructuredRequest,
  ): Promise<AIStructuredResponse<T>> {
    const content: ResponseInputContent[] = [
      { type: "input_text", text: request.inputText },
    ];
    const images = request.images ?? (request.image ? [request.image] : []);
    for (const image of images)
      content.push({
        type: "input_image",
        detail: "high",
        image_url: imageDataUrl(image, this.config.maxImageMb),
      });
    const started = Date.now();
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const response = await this.client.responses.create({
          model: request.model,
          instructions: request.instructions,
          input: [{ role: "user", content }],
          reasoning: { effort: request.reasoningEffort },
          max_output_tokens: request.maxOutputTokens,
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: request.schemaName,
              schema: request.jsonSchema,
              strict: true,
            },
          },
          prompt_cache_key: `pica-forensics-${request.pass}`,
          store: false,
        });
        if (!response.output_text)
          throw new AIResponseError("OpenAI returned no structured output.");
        let data: T;
        try {
          data = JSON.parse(response.output_text) as T;
        } catch (error) {
          throw new AIResponseError("OpenAI returned malformed JSON.", error);
        }
        return {
          requestId: response.id,
          model: response.model,
          data,
          usage: normalizeOpenAIUsage(response.usage),
          durationMs: Date.now() - started,
          imageInputCount: images.length,
        };
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === this.config.maxRetries)
          throw mapError(error);
        await wait(Math.min(250 * 2 ** attempt, 2000));
      }
    }
    throw mapError(lastError);
  }
}
