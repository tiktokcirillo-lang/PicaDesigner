import {Router, type Response} from 'express';
import {createCreativeDirection} from '../../application/creative-direction/index.js';
import type {CreativeDirectionRequest} from '../../domain/creative-direction/index.js';
import {applicationBudgetStore as budgetStore} from '../../infrastructure/ai/budget/runtime-store.js';
import {AIAuthenticationError, AIBudgetExceededError, AIProviderError, AIRateLimitError, AISchemaError, AITimeoutError, safeErrorMessage} from '../../infrastructure/ai/providers/errors.js';
import {loadOpenAIConfig} from '../../infrastructure/ai/providers/openai/config.js';
import {OpenAIProvider} from '../../infrastructure/ai/providers/openai/responses.js';

const sendError = (response: Response, error: unknown) => {
  const status = error instanceof AIAuthenticationError ? 401 : error instanceof AIBudgetExceededError ? 402 : error instanceof AIRateLimitError ? 429 : error instanceof AITimeoutError ? 504 : error instanceof AISchemaError ? 422 : error instanceof AIProviderError ? 500 : 500;
  return response.status(status).json({error: safeErrorMessage(error)});
};

export const createCreativeDirectionRouter = (): Router => {
  const router = Router();
  router.post('/generate', async (request, response) => {
    try {
      const body = request.body as Partial<CreativeDirectionRequest>;
      if (!body.projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(body.projectId)) return response.status(400).json({error: 'projectId is invalid'});
      if (typeof body.copy !== 'string' || body.copy.length > 10_000) return response.status(400).json({error: 'copy must be a string with at most 10,000 characters'});
      if (!body.format?.trim() || !body.destinationTool?.trim() || !body.tone?.trim()) return response.status(400).json({error: 'format, destinationTool and tone are required'});
      const config = loadOpenAIConfig();
      return response.json(await createCreativeDirection(body as CreativeDirectionRequest, {config, provider: new OpenAIProvider(config), budgetStore}));
    } catch (error) { return sendError(response, error); }
  });
  return router;
};
