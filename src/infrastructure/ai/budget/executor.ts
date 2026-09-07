import {calculateActualCost,estimateCallCost,type EstimatedCallUsage} from './cost-calculator.js';
import {ProjectAIBudgetCoordinator} from './project-coordinator.js';
import type {BudgetStore} from './budget-tracker.js';
import type {AIProvider,AIStage,AIStructuredRequest,AIStructuredResponse,ProjectCostLedger} from '../types.js';
import {AITimeoutError} from '../providers/errors.js';

const stageFor=(pass:AIStructuredRequest['pass']):AIStage=>pass==='creative_direction'?'creative_direction':pass==='generate_design_spec'?'design_spec':pass==='sol_critic'?'senior_critic':pass==='refine_copy'?'other':['observation','relationships','domain_analysis','principle_inference','consistency_critique','repair'].includes(pass)?'visual_forensics':'other';
const stableOperationId=(request:AIStructuredRequest)=>{const value=`${request.projectId}|${stageFor(request.pass)}|${request.pass}|${request.schemaName}|${request.repairAttempt?'repair':'initial'}|${request.inputText}`;let hash=2166136261;for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619);return`${request.projectId}:${request.pass}:${(hash>>>0).toString(16)}`;};
export interface BudgetedExecutorOptions{monthlyLimitUsd?:number;safetyFactor?:number;ttlSeconds?:number;stage?:AIStage;stageLimitUsd?:number}

export class BudgetedAIExecutor {
  private readonly coordinator:ProjectAIBudgetCoordinator;
  constructor(private readonly provider:AIProvider,store:BudgetStore,hardLimitUsd:number,private ledger:ProjectCostLedger,legacyMonthlyRemainingUsd=Number.POSITIVE_INFINITY,private readonly options:BudgetedExecutorOptions={}){this.coordinator=new ProjectAIBudgetCoordinator(store,{projectLimitUsd:hardLimitUsd,monthlyLimitUsd:Math.min(options.monthlyLimitUsd??15,legacyMonthlyRemainingUsd),safetyFactor:options.safetyFactor??1.2,ttlSeconds:options.ttlSeconds??600});}
  getLedger(){return this.ledger;}
  async execute<T>(request:AIStructuredRequest,estimate:EstimatedCallUsage):Promise<AIStructuredResponse<T>>{
    const estimatedCostUsd=estimateCallCost(request.model,estimate);const stage=request.pass==='sol_critic'?'senior_critic':this.options.stage??stageFor(request.pass);const operationId=stableOperationId(request);const reservation=await this.coordinator.reserve({projectId:request.projectId,stage,estimatedCostUsd,stageLimitUsd:this.options.stageLimitUsd,operationId});
    try{const response=await this.provider.generateStructured<T>(request);const costUsd=calculateActualCost(response.model,response.usage);const call={...response.usage,requestId:response.requestId,pass:request.pass,model:response.model,costUsd,durationMs:response.durationMs,maxOutputTokens:request.maxOutputTokens,outputTokenUtilization:request.maxOutputTokens>0?response.usage.outputTokens/request.maxOutputTokens:0,repairAttempt:request.repairAttempt??false,stage,operationId};this.ledger=await this.coordinator.commit(reservation.reservationId,call);return response;}catch(error){if(error instanceof AITimeoutError)await this.coordinator.resolveUnknown(reservation.reservationId);else await this.coordinator.release(reservation.reservationId);throw error;}
  }
}
