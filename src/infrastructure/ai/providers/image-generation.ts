export interface ImageGenerationInput {
  prompt: string;
  projectId: string;
}

export interface ImageGenerationResult {
  mediaType: string;
  data: string;
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly available: boolean;
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
}

export class UnavailableImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'unavailable';
  readonly available = false;
  async generate(_input: ImageGenerationInput): Promise<ImageGenerationResult> {
    throw new AIProviderError('Image generation is temporarily unavailable.');
  }
}
import {AIProviderError} from './errors';
