import type {BrandAsset, BrandAssetAnalysis, BrandAssetAnalyzer} from './types.js';

export class MockBrandAssetAnalyzer implements BrandAssetAnalyzer {
  readonly id = 'mock-brand-asset-analyzer';
  constructor(private readonly fixture: BrandAssetAnalysis = {patterns: [], inferredConstraints: [], confidence: 0, warnings: ['No analyzed brand assets.']}) {}
  async analyze(_assets: BrandAsset[]): Promise<BrandAssetAnalysis> {return structuredClone(this.fixture);}
}
