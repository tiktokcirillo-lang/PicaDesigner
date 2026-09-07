import {Router, type Response} from 'express';
import {generateDesignSpec, refineCopy} from '../../application/legacy-ai/text-services';
import {InMemoryBudgetStore} from '../../infrastructure/ai/budget/budget-tracker';
import {AIAuthenticationError, AIBudgetExceededError, AIProviderError, AIRateLimitError, AISchemaError, AITimeoutError, UnsupportedAIInputError, safeErrorMessage} from '../../infrastructure/ai/providers/errors';
import {loadOpenAIConfig} from '../../infrastructure/ai/providers/openai/config';
import {OpenAIProvider} from '../../infrastructure/ai/providers/openai/responses';
import type {VisualInput} from '../../domain/visual-forensics';

const budgetStore = new InMemoryBudgetStore();
const sendError = (response: Response, error: unknown) => {
  const status = error instanceof UnsupportedAIInputError ? 400
    : error instanceof AIAuthenticationError ? 401
    : error instanceof AIBudgetExceededError ? 402
    : error instanceof AIRateLimitError ? 429
    : error instanceof AITimeoutError ? 504
    : error instanceof AISchemaError ? 422
    : error instanceof AIProviderError ? 500 : 500;
  return response.status(status).json({error: safeErrorMessage(error)});
};

const dependencies = () => {
  const config = loadOpenAIConfig();
  return {config, provider: new OpenAIProvider(config), budgetStore};
};

export const createLegacyAIRouter = (): Router => {
  const router = Router();
  router.post('/refine-copy', async (request, response) => {
    try {
      const {text, tone = 'professional', projectId = `copy-${Date.now()}`} = request.body as {text?: string; tone?: string; projectId?: string};
      if (!text?.trim() || text.length > 10_000) return response.status(400).json({error: 'text is required and must be at most 10,000 characters'});
      return response.json(await refineCopy({text: text.trim(), tone, projectId}, dependencies()));
    } catch (error) {return sendError(response, error);}
  });
  router.post('/generate-design-spec', async (request, response) => {
    try {
      const {prompt, image, projectId = `design-${Date.now()}`} = request.body as {prompt?: string; image?: VisualInput; projectId?: string};
      if (!prompt?.trim() || prompt.length > 50_000) return response.status(400).json({error: 'prompt is required and must be at most 50,000 characters'});
      return response.json(await generateDesignSpec({prompt: prompt.trim(), image, projectId}, dependencies()));
    } catch (error) {return sendError(response, error);}
  });
  return router;
};
