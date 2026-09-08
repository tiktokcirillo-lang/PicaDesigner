import {buildVisualQaBatches,type PostRenderVisualQaProvider,type VisualQaTarget} from '../../domain/post-render-review/index.js';
import type {ProjectAIBudgetCoordinator} from '../ai/budget/project-coordinator.js';
import type {AIModelCall} from '../ai/types.js';

export class BudgetedPostRenderVisualQaProvider implements PostRenderVisualQaProvider{
  readonly id:string;
  constructor(private readonly provider:PostRenderVisualQaProvider,private readonly budget:ProjectAIBudgetCoordinator,private readonly projectId:string,private readonly model:string,private readonly estimateUsd:number,private readonly stageLimitUsd:number,private readonly maxImages=4){this.id=provider.id}
  async review(targets:VisualQaTarget[],context:Record<string,unknown>){
    const batches=buildVisualQaBatches(targets,this.maxImages),fullEstimate=this.estimateUsd*Math.max(1,batches.length),operationId=`qa:${targets.map(target=>target.checksum).join(':')}`;
    let selected=targets,estimated=fullEstimate,partial=false,reservation;
    try{reservation=await this.budget.reserve({projectId:this.projectId,stage:'post_render_qa',estimatedCostUsd:estimated,stageLimitUsd:this.stageLimitUsd,operationId})}catch(error){if(batches.length<=1)throw error;selected=batches[0]!;estimated=this.estimateUsd;partial=true;reservation=await this.budget.reserve({projectId:this.projectId,stage:'post_render_qa',estimatedCostUsd:estimated,stageLimitUsd:this.stageLimitUsd,operationId:`${operationId}:partial`})}
    const started=Date.now();
    try{const result=await this.provider.review(selected,{...context,visualCoverage:partial?'partial_visual_coverage':'complete',omittedTargetIds:partial?targets.filter(target=>!selected.includes(target)).map(target=>target.id):[]});if(partial){result.strengths=[...result.strengths,'partial_visual_coverage'];result.confidence=Math.min(result.confidence,.74)}const call:AIModelCall={requestId:`qa_${Date.now()}`,pass:'post_render_qa',model:this.model,inputTokens:0,cachedInputTokens:0,cacheWriteTokens:0,outputTokens:0,costUsd:estimated,durationMs:Date.now()-started,maxOutputTokens:3000,outputTokenUtilization:0,repairAttempt:false,stage:'post_render_qa',operationId,imageInputCount:selected.length};await this.budget.commit(reservation.reservationId,call);return result}catch(error){if(error instanceof Error&&error.message.toLowerCase().includes('timeout'))await this.budget.resolveUnknown(reservation.reservationId);else await this.budget.release(reservation.reservationId);throw error}
  }
}
