import express from 'express';
import {loadOpenAIConfig} from '../infrastructure/ai/providers/openai/config.js';
import {createLegacyAIRouter} from './api/legacy-ai.js';
import {createVisualForensicsRouter} from './api/visual-forensics.js';
import {createCreativeDirectionRouter} from './api/creative-direction.js';

export const createServerApp = () => {
  const config = loadOpenAIConfig();
  const app = express();
  app.use(express.json({limit: `${config.maxImageMb + 1}mb`}));
  app.get('/api/health', (_request, response) => response.json({status: 'ok', service: 'picadesigner-api'}));
  app.use('/api/visual-forensics', createVisualForensicsRouter());
  app.use('/api/creative-direction', createCreativeDirectionRouter());
  app.use('/api/ai', createLegacyAIRouter());
  return app;
};
