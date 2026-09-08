import type {PostRenderVisualReview,VisualQaTarget} from './types.js';

export const buildVisualQaBatches=(targets:VisualQaTarget[],maxImages=4):VisualQaTarget[][]=>{
  const limit=Math.max(2,Math.floor(maxImages));
  const composite=targets.find(target=>target.type==='composite');
  const assets=targets.filter(target=>target.type==='generated_asset').sort((a,b)=>a.id.localeCompare(b.id));
  if(!composite)return assets.length?[assets.slice(0,limit)]:[];
  if(!assets.length)return[[composite]];
  const batches:VisualQaTarget[][]=[];
  for(let index=0;index<assets.length;index+=limit-1)batches.push([composite,...assets.slice(index,index+limit-1)]);
  return batches;
};

export const mergePostRenderReviews=(reviews:PostRenderVisualReview[]):PostRenderVisualReview=>{
  if(!reviews.length)throw new Error('Cannot merge an empty QA review set.');
  const severity:Record<PostRenderVisualReview['verdict'],number>={approved:0,approved_with_notes:1,regeneration_required:2,upstream_revision_required:3,rejected:4};
  const issues=new Map<string,PostRenderVisualReview['issues'][number]>(),assets=new Map<string,{targetRef:string;score:number}>();
  for(const review of reviews){for(const issue of review.issues)issues.set(`${issue.targetRef}:${issue.domain}:${issue.diagnosis}`,issue);for(const result of review.assetResults)assets.set(result.targetRef,result)}
  const worst=[...reviews].sort((a,b)=>severity[b.verdict]-severity[a.verdict])[0]!;
  return{...worst,overallScore:Math.min(...reviews.map(r=>r.overallScore)),confidence:Math.min(...reviews.map(r=>r.confidence)),dimensions:Object.assign({},...reviews.map(r=>r.dimensions)),issues:[...issues.values()],strengths:[...new Set(reviews.flatMap(r=>r.strengths))],assetResults:[...assets.values()],compositeResult:reviews.map(r=>r.compositeResult).filter((r):r is NonNullable<PostRenderVisualReview['compositeResult']>=>Boolean(r)).sort((a,b)=>a.score-b.score)[0],requiresRegeneration:reviews.some(r=>r.requiresRegeneration),requiresUpstreamRevision:reviews.some(r=>r.requiresUpstreamRevision)};
};
