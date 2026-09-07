import {Router} from 'express';
import {analyzeReferenceImage} from '../../application/visual-intelligence/analyze-reference-image';
import {InMemoryBudgetStore} from '../../infrastructure/ai/budget/budget-tracker';
import {safeErrorMessage} from '../../infrastructure/ai/providers/errors';
import {loadOpenAIConfig} from '../../infrastructure/ai/providers/openai/config';
import {OpenAIProvider} from '../../infrastructure/ai/providers/openai/responses';
import type {VisualForensicsInput} from '../../domain/visual-forensics';

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
      return response.status(500).json({error: safeErrorMessage(error)});
    }
  });
  return router;
};
