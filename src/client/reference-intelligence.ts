import {DESIGN_DNA_SCHEMA_VERSION} from '../domain/art-direction/index.js';
import {VISUAL_FORENSICS_SCHEMA_VERSION, type AnalysisDepth} from '../domain/visual-forensics/index.js';
import {REFERENCE_INTELLIGENCE_SCHEMA_VERSION, type ReferenceIntelligenceSession, type ReferenceSourceMetadata} from '../application/reference-intelligence/index.js';
import type {ProjectSourceAssetSummary} from '../domain/source-assets/index.js';

export interface BrowserReferenceImage {data: string; mimeType: string; name: string; size?: number; lastModified?: number; width?: number; height?: number}
const sessionCache = new Map<string, ReferenceIntelligenceSession>();

const parseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {await response.text(); throw new Error(`HTTP ${response.status}: resposta inesperada da infraestrutura.`);}
  const payload = await response.json() as {error?: string};
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}: falha na análise visual.`);
  return payload;
};

export const fingerprintReferenceImage = async (image: BrowserReferenceImage): Promise<string> => {
  const payload = new TextEncoder().encode([image.mimeType, image.name, image.size ?? '', image.lastModified ?? '', image.data].join(':'));
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const isReusableReferenceSession = (session: ReferenceIntelligenceSession | undefined, fingerprint: string, depth: AnalysisDepth, projectId: string): session is ReferenceIntelligenceSession => Boolean(
  session
  && session.schemaVersion === REFERENCE_INTELLIGENCE_SCHEMA_VERSION
  && session.forensicsSchemaVersion === VISUAL_FORENSICS_SCHEMA_VERSION
  && session.designDNASchemaVersion === DESIGN_DNA_SCHEMA_VERSION
  && session.projectId === projectId
  && session.source.imageFingerprint === fingerprint
  && session.analysisDepth === depth
  && (session.status === 'ready' || session.status === 'partial'),
);

export const analyzeVisualReference = async (input: {image: BrowserReferenceImage; projectId: string; analysisDepth?: AnalysisDepth; existingSession?: ReferenceIntelligenceSession}): Promise<ReferenceIntelligenceSession> => {
  const analysisDepth = input.analysisDepth ?? 'standard';
  const fingerprint = await fingerprintReferenceImage(input.image);
  const cached = input.existingSession ?? sessionCache.get(`${fingerprint}:${analysisDepth}`);
  if (isReusableReferenceSession(cached, fingerprint, analysisDepth, input.projectId)) return cached;
  const imageMetadata: Omit<ReferenceSourceMetadata, 'mediaType'> = {fileName: input.image.name, fileSize: input.image.size, lastModified: input.image.lastModified, width: input.image.width, height: input.image.height, aspectRatio: input.image.width && input.image.height ? input.image.width / input.image.height : undefined, imageFingerprint: fingerprint};
  const response = await fetch('/api/visual-forensics/analyze', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({projectId: input.projectId, image: {kind: 'base64', data: input.image.data, mediaType: input.image.mimeType}, imageMetadata, analysisDepth})});
  const session = await parseResponse(response) as ReferenceIntelligenceSession;
  sessionCache.set(`${fingerprint}:${analysisDepth}`, session);
  return session;
};

export const analyzeDurableVisualReference = async (input:{sourceAsset:ProjectSourceAssetSummary;projectId:string;analysisDepth?:AnalysisDepth;existingSession?:ReferenceIntelligenceSession}):Promise<ReferenceIntelligenceSession>=>{
  const analysisDepth=input.analysisDepth??'standard',fingerprint=input.sourceAsset.checksum,cached=input.existingSession??sessionCache.get(`${fingerprint}:${analysisDepth}`);
  if(isReusableReferenceSession(cached,fingerprint,analysisDepth,input.projectId))return cached;
  const response=await fetch('/api/visual-forensics/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:input.projectId,sourceAssetId:input.sourceAsset.assetId,analysisDepth})});
  const session=await parseResponse(response) as ReferenceIntelligenceSession;
  sessionCache.set(`${fingerprint}:${analysisDepth}`,session);
  return session;
};

export const invalidateReferenceIntelligence = (): void => sessionCache.clear();
