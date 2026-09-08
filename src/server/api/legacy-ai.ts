import {Router, type Response} from 'express';
import {generateDesignSpec, refineCopy} from '../../application/legacy-ai/text-services.js';
import {applicationBudgetStore as budgetStore} from '../../infrastructure/ai/budget/runtime-store.js';
import {AIAuthenticationError, AIBudgetExceededError, AIProviderError, AIRateLimitError, AISchemaError, AITimeoutError, UnsupportedAIInputError, safeErrorMessage} from '../../infrastructure/ai/providers/errors.js';
import {loadOpenAIConfig} from '../../infrastructure/ai/providers/openai/config.js';
import {OpenAIProvider} from '../../infrastructure/ai/providers/openai/responses.js';
import type {VisualInput} from '../../domain/visual-forensics/index.js';
import type {GenerateDesignSpecRequest} from '../../application/design-spec/index.js';

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
      const body = request.body as Partial<GenerateDesignSpecRequest> & {prompt?: string; image?: VisualInput};
      const projectId = body.projectId?.trim() || `design-${Date.now()}`;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return response.status(400).json({error: 'projectId is invalid'});
      if (body.prompt) {
        if (body.prompt.length > 50_000) return response.status(400).json({error: 'legacy prompt must be at most 50,000 characters'});
        return response.json(await generateDesignSpec({projectId, copy: '', format: 'legacy', destinationTool: 'legacy', tone: 'legacy', legacyPrompt: body.prompt}, dependencies()));
      }
      if (typeof body.copy !== 'string' || body.copy.length > 10_000) return response.status(400).json({error: 'copy must be a string with at most 10,000 characters'});
      if (!body.format?.trim() || body.format.length > 120) return response.status(400).json({error: 'format is required'});
      if (!body.destinationTool?.trim() || body.destinationTool.length > 120) return response.status(400).json({error: 'destinationTool is required'});
      if (!body.tone?.trim() || body.tone.length > 200) return response.status(400).json({error: 'tone is required'});
      return response.json(await generateDesignSpec({projectId, copy: body.copy, format: body.format, formatContext: body.formatContext, destinationTool: body.destinationTool, tone: body.tone, brandInput: body.brandInput, brandIntelligence: body.brandIntelligence, referenceIntelligence: body.referenceIntelligence, adaptedDesignConstraints: body.adaptedDesignConstraints, creativeDirection: body.creativeDirection, layoutIntelligence: body.layoutIntelligence,artDirectorReview:body.artDirectorReview,reviewedDesignPackage:body.reviewedDesignPackage}, dependencies()));
    } catch (error) {return sendError(response, error);}
  });
  return router;
};
