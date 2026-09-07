import type {CreativeDirectionRequest, CreativeDirectionSession} from '../domain/creative-direction/index.js';

export const ensureCreativeDirection = async (input: CreativeDirectionRequest): Promise<CreativeDirectionSession> => {
  const response = await fetch('/api/creative-direction/generate', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)});
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) { await response.text(); throw new Error(`HTTP ${response.status}: resposta inesperada da infraestrutura.`); }
  const payload = await response.json() as CreativeDirectionSession & {error?: string};
  if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
  return payload;
};
