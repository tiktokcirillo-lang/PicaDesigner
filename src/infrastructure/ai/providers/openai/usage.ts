import type {ResponseUsage} from 'openai/resources/responses/responses';
import type {AIUsage} from '../../types.js';
export const normalizeOpenAIUsage = (usage: ResponseUsage | null | undefined): AIUsage => ({
  inputTokens: usage?.input_tokens ?? 0,
  cachedInputTokens: usage?.input_tokens_details.cached_tokens ?? 0,
  cacheWriteTokens: usage?.input_tokens_details.cache_write_tokens ?? 0,
  outputTokens: usage?.output_tokens ?? 0,
  reasoningTokens: usage?.output_tokens_details.reasoning_tokens ?? 0,
});
