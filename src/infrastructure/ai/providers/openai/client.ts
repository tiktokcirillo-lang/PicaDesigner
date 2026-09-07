import OpenAI from 'openai';
import {AIAuthenticationError} from '../errors';
import type {OpenAIConfig} from './config';

export const createOpenAIClient = (config: OpenAIConfig): OpenAI => {
  if (!config.apiKey) throw new AIAuthenticationError('OPENAI_API_KEY is not configured on the server.');
  return new OpenAI({apiKey: config.apiKey, timeout: config.requestTimeoutMs, maxRetries: 0});
};
