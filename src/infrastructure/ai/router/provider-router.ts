import {AIProviderError} from '../providers/errors';
import type {AIProvider, AIProviderId} from '../types';
export class ProviderRouter {
  private readonly providers = new Map<AIProviderId, AIProvider>();
  register(provider: AIProvider): this {this.providers.set(provider.id, provider); return this;}
  resolve(id: AIProviderId): AIProvider {const provider = this.providers.get(id); if (!provider) throw new AIProviderError(`AI provider is not configured: ${id}`); return provider;}
}
