import {Router} from 'express';
import {analyzeReferenceImage} from '../../application/visual-intelligence/analyze-reference-image.js';
import {InMemoryBudgetStore} from '../../infrastructure/ai/budget/budget-tracker.js';
import {AIAuthenticationError, AIBudgetExceededError, AIProviderError, AIRateLimitError, AISchemaError, AITimeoutError, AnalysisPipelineError, UnsupportedAIInputError, safeErrorMessage} from '../../infrastructure/ai/providers/errors.js';
import {loadOpenAIConfig} from '../../infrastructure/ai/providers/openai/config.js';
import {OpenAIProvider} from '../../infrastructure/ai/providers/openai/responses.js';
import type {VisualForensicsInput} from '../../domain/visual-forensics/index.js';

const budgetStore = new InMemoryBudgetStore();
export const createVisualForensicsRouter = (): Router => {
  const router = Router();
  router.post('/analyze', async (request, response) => {
    try {
      const body = request.body as Partial<VisualForensicsInput> & {projectId?: string};
      if (!body.image || !body.projectId) return response.status(400).json({error: 'image and projectId are required'});
      const config = loadOpenAIConfig();
      const result = await analyzeReferenceImage({image: body.image, projectId: body.projectId, analysisDepth: body.analysisDepth, semanticExclusions: body.semanticExclusions, context: body.context, language: body.language}, {provider: new OpenAIProvider(config), budgetStore, config});
      return response.json(result);
    } catch (error) {
      const status = error instanceof UnsupportedAIInputError ? 400
        : error instanceof AIAuthenticationError ? 401
        : error instanceof AIBudgetExceededError ? 402
        : error instanceof AIRateLimitError ? 429
        : error instanceof AITimeoutError ? 504
        : error instanceof AISchemaError || error instanceof AnalysisPipelineError ? 422
        : error instanceof AIProviderError ? 500 : 500;
      return response.status(status).json({error: safeErrorMessage(error)});
    }
  });
  return router;
};
