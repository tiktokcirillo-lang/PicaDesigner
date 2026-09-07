import type {AIProvider, AIStructuredRequest, AIStructuredResponse, AIUsage} from '../types.js';

export type MockResponseFactory = (request: AIStructuredRequest, callIndex: number) => unknown;
export class MockAIProvider implements AIProvider {
  readonly id = 'mock' as const;
  private callIndex = 0;
  constructor(private readonly factory: MockResponseFactory, private readonly usage: AIUsage = {inputTokens: 1200, cachedInputTokens: 200, cacheWriteTokens: 0, outputTokens: 500}) {}
  async generateStructured<T>(request: AIStructuredRequest): Promise<AIStructuredResponse<T>> {const index = this.callIndex++; return {requestId: `mock-${index + 1}`, model: request.model, data: this.factory(request, index) as T, usage: {...this.usage}, durationMs: 1};}
  getCallCount(): number {return this.callIndex;}
}
