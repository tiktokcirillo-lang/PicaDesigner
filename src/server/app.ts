import express from 'express';
import {loadOpenAIConfig} from '../infrastructure/ai/providers/openai/config';
import {createLegacyAIRouter} from './api/legacy-ai';
import {createVisualForensicsRouter} from './api/visual-forensics';

export const createServerApp = () => {
  const config = loadOpenAIConfig();
  const app = express();
  app.use(express.json({limit: `${config.maxImageMb + 1}mb`}));
  app.use('/api/visual-forensics', createVisualForensicsRouter());
  app.use('/api/ai', createLegacyAIRouter());
  return app;
};
