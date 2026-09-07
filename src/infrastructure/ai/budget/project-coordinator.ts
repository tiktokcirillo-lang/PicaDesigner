import type {AIModelCall,AIStage,BudgetReservation,ProjectAIUsageSnapshot} from '../types.js';
import {type BudgetStore} from './budget-tracker.js';
import {reserveMicroUsd,usdToMicroUsd} from './money.js';

export class ProjectAIBudgetCoordinator {
  constructor(private readonly store:BudgetStore,private readonly policy:{projectLimitUsd:number;monthlyLimitUsd:number;safetyFactor:number;ttlSeconds:number}) {}
  async ledger(projectId:string){return this.store.getProject(projectId);}
  async reserve(input:{projectId:string;stage:AIStage;estimatedCostUsd:number;stageLimitUsd?:number;operationId?:string}):Promise<BudgetReservation>{return this.store.reserve({projectId:input.projectId,month:new Date().toISOString().slice(0,7),stage:input.stage,operationId:input.operationId,estimatedMicroUsd:reserveMicroUsd(input.estimatedCostUsd,this.policy.safetyFactor),projectLimitMicroUsd:usdToMicroUsd(this.policy.projectLimitUsd),monthlyLimitMicroUsd:usdToMicroUsd(this.policy.monthlyLimitUsd),stageLimitMicroUsd:input.stageLimitUsd===undefined?undefined:usdToMicroUsd(input.stageLimitUsd),ttlSeconds:this.policy.ttlSeconds});}
  commit(reservationId:string,call:AIModelCall){return this.store.commit(reservationId,call);}
  release(reservationId:string){return this.store.release(reservationId);}
  resolveUnknown(reservationId:string){return this.store.resolveUnknown(reservationId);}
  snapshot(projectId:string):Promise<ProjectAIUsageSnapshot>{return this.store.getUsageSnapshot(projectId,new Date().toISOString().slice(0,7),this.policy.projectLimitUsd,this.policy.monthlyLimitUsd);}
  get budgetStore() {return this.store;}
}
