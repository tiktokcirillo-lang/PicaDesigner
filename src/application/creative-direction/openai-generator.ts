import {validateCreativeCandidateSet,type CommunicationBrief,type CreativeDirectionRequest,type CreativeRouteCandidateSet,type CreativeRouteGenerator} from '../../domain/creative-direction/index.js';
import {buildReferenceDesignContext} from '../reference-intelligence/design-context.js';
import {buildBrandDesignContext,adaptReferenceDNA,resolveBrandReferenceCompatibility} from '../../domain/brand-intelligence/index.js';
import {AISchemaError} from '../../infrastructure/ai/providers/errors.js';import {BudgetedAIExecutor} from '../../infrastructure/ai/budget/executor.js';
import {CREATIVE_DIRECTION_OUTPUT_SCHEMA} from './output-schema.js';
import {buildCreativePromptModules} from './prompt-modules.js';
export {CREATIVE_DIRECTION_OUTPUT_SCHEMA} from './output-schema.js';
export class OpenAICreativeRouteGenerator implements CreativeRouteGenerator{
 constructor(private executor:BudgetedAIExecutor,private model:string){}
 async generate(input:{brief:CommunicationBrief;request:CreativeDirectionRequest}):Promise<CreativeRouteCandidateSet>{
  const brand=input.request.brandIntelligence?.brandDNA;const compatibility=brand?resolveBrandReferenceCompatibility(brand,input.request.referenceIntelligence?.designDNA):undefined;const adapted=input.request.adaptedDesignConstraints??(brand?adaptReferenceDNA(input.request.referenceIntelligence?.designDNA,brand,compatibility):undefined);const compactBrand=brand&&compatibility&&adapted?buildBrandDesignContext(brand,compatibility,adapted):undefined;const compactReference=input.request.referenceIntelligence?buildReferenceDesignContext(input.request.referenceIntelligence):undefined;
const modules=buildCreativePromptModules(input.brief,input.request,{brand:compactBrand,reference:compactReference,adapted});
  const request={projectId:input.request.projectId,pass:'creative_direction' as const,model:this.model,instructions:JSON.stringify({creativePolicy:modules.creativePolicy,antiCliche:modules.antiCliche,antiAi:modules.antiAi,routeDivergence:modules.routeDivergence,outputContract:modules.outputContract}),inputText:JSON.stringify({communicationBrief:modules.communicationBrief,approvedMessageHierarchy:modules.approvedMessageHierarchy,brandConstraints:modules.brandConstraints,referencePrinciples:modules.referencePrinciples,adaptedConstraints:modules.adaptedConstraints,project:modules.project}),schemaName:'creative_direction_routes',jsonSchema:CREATIVE_DIRECTION_OUTPUT_SCHEMA,reasoningEffort:'medium' as const,maxOutputTokens:6000};
  let response=await this.executor.execute<CreativeRouteCandidateSet>(request,{inputTokens:10000,cachedInputTokens:1500,outputTokens:4500});
  if(validateCreativeCandidateSet(response.data))return response.data;
  response=await this.executor.execute<CreativeRouteCandidateSet>({...request,repairAttempt:true,instructions:`${request.instructions}\nRepair structure only; preserve the same ideas.`},{inputTokens:7000,cachedInputTokens:1000,outputTokens:4500});
  if(!validateCreativeCandidateSet(response.data))throw new AISchemaError('Creative Direction remained invalid after one repair.');return response.data;
 }
}
