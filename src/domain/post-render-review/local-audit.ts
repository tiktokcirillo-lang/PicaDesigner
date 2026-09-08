import {createHash} from 'node:crypto';
import type {GeneratedAssetStore,ImageAssetSession} from '../image-assets/index.js';
import type {RenderSession} from '../render-engine/index.js';
import type {LocalPostRenderAudit} from './types.js';

export const runLocalPostRenderAudit=async(render:RenderSession,assets:ImageAssetSession|undefined,store:GeneratedAssetStore):Promise<LocalPostRenderAudit>=>{
  const checks:Record<string,boolean>={productionReady:render.readiness.productionReady,requiredResolved:render.readiness.missingRequiredAssets.length===0,fontsReady:render.readiness.fontIssues.length===0,textFit:render.readiness.textFitIssues.length===0,canonicalAssets:render.artifacts.every(artifact=>!artifact.svg.includes('ASSET:')),canvasValid:render.renderDocument.scenes.every(scene=>scene.width>0&&scene.height>0)};
  if(assets)for(const asset of assets.activeGeneratedAssets??assets.generatedAssets){try{const bytes=asset.backingRef&&await store.get(asset.backingRef,render.projectId);checks[`backing:${asset.id}`]=Boolean(bytes&&createHash('sha256').update(bytes).digest('hex')===asset.checksum)}catch{checks[`backing:${asset.id}`]=false}}
  const blockers=Object.entries(checks).filter(([,valid])=>!valid).map(([name])=>name);return{passed:!blockers.length,blockers,checks};
};
