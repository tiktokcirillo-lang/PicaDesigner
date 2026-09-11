import { resolvePicaDesignerProviderMode } from "../provider-mode.js";
import type { AIProvider, AIStructuredRequest, AIStructuredResponse } from "../types.js";
import { MockAIProvider, type MockResponseFactory } from "./mock.js";
import type { OpenAIConfig } from "./openai/config.js";
import { OpenAIProvider } from "./openai/responses.js";

export interface AIProviderInstrumentation {
  mockStructuredProviderCalls: number;
  openAIProviderCalls: number;
  paidProviderCalls: number;
  realNetworkCalls: number;
  aiCostUsd: number;
}

export const createAIProviderInstrumentation = (): AIProviderInstrumentation => ({
  mockStructuredProviderCalls: 0,
  openAIProviderCalls: 0,
  paidProviderCalls: 0,
  realNetworkCalls: 0,
  aiCostUsd: 0,
});

class InstrumentedProvider implements AIProvider {
  readonly id;
  constructor(
    private readonly provider: AIProvider,
    private readonly instrumentation: AIProviderInstrumentation,
  ) {
    this.id = provider.id;
  }
  async generateStructured<T>(request: AIStructuredRequest): Promise<AIStructuredResponse<T>> {
    if (this.provider.id === "mock") this.instrumentation.mockStructuredProviderCalls += 1;
    else {
      this.instrumentation.openAIProviderCalls += 1;
      this.instrumentation.paidProviderCalls += 1;
      this.instrumentation.realNetworkCalls += 1;
    }
    return this.provider.generateStructured<T>(request);
  }
}

export interface StructuredAIProviderFactoryOptions {
  config: OpenAIConfig;
  env?: NodeJS.ProcessEnv;
  mockFactory?: MockResponseFactory;
  instrumentation?: AIProviderInstrumentation;
}
let testInstrumentation: AIProviderInstrumentation | undefined;
export const setStructuredAIProviderInstrumentationForTests = (
  instrumentation?: AIProviderInstrumentation,
): void => {
  if (process.env.NODE_ENV === "production")
    throw new Error("AI provider test instrumentation is forbidden in production.");
  testInstrumentation = instrumentation;
};

const defaultMockResponse: MockResponseFactory = (request) => {
  if (request.pass === "creative_direction") {
    const payload = JSON.parse(request.inputText) as { approvedMessageHierarchy?: Array<{ id?: string }> };
    const approvedHierarchy = payload.approvedMessageHierarchy ?? [];
    const approvedMessageRefs = approvedHierarchy.map((item) => item.id).filter((id): id is string => Boolean(id));
    const route = (id: string, values: number[]) => ({
      id, internalName: `Mock route ${id}`,
      territory: { name: `Territory ${id}`, logic: "A communication-led territory.", relevance: "Supports the approved proposition.", confidence: 0.9 },
      concept: { name: `Concept ${id}`, coreIdea: `Approved message becomes a structured reveal ${id}.`, strategicRationale: "Makes the approved message clear.", visualThesis: { dominantElement: "Approved primary message", dominanceReason: "It carries the proposition.", memorabilityMechanism: "Purposeful contrast", communicatingRelationship: "Message and device reinforce each other.", brandRecognition: "Declared assets remain visible." }, audienceTakeaway: "Understand and act.", brandRelevance: "Respects declared brand rules.", communicationRelevance: "Clarifies the proposition." },
      strategicRationale: "Focus the approved message through a repeatable reveal.", creativeTension: null, visualMetaphor: null,
      creativeDevice: { name: `Structured reveal ${id}`, description: "A repeatable frame reveals information deliberately.", communicationFunction: "Direct attention to the primary message.", brandConnection: "Uses declared brand behavior.", repeatability: 0.9, distinctiveness: 0.85, productionFeasibility: 0.9 },
      heroStrategy: "typography", compositionStrategy: "Asymmetric split with protected negative space.", hierarchyStrategy: "One dominant message followed by support.",
      typographyBehavior: { typographicRole: "Primary message carrier.", scaleContrast: "Controlled high contrast.", density: "Restrained.", expressiveness: "Purposeful.", alignmentCharacter: "Structured.", headlineBehavior: "Dominant.", dataBehavior: "Supporting." },
      colorBehavior: { dominance: "Brand primary.", accentBehavior: "Sparse.", contrast: "Accessible.", coverageLogic: "Role-based.", backgroundRole: "Support hierarchy.", foregroundRole: "Carry content.", tokenPolicy: "Use declared tokens." },
      imageStrategy: { mode: "none", subjectRole: "No literal subject required.", framingCharacter: "Restrained.", lightingCharacter: "Physically coherent.", backgroundCharacter: "Controlled field.", authenticity: "No invented imagery.", depthCharacter: "Flat.", retouchingCharacter: "None." },
      shapeStrategy: "Purposeful shapes only.", materialStrategy: { required: false, characters: ["digital-flat"], conceptualRole: "No decorative material." }, textureStrategy: "Restrained.",
      spatialStrategy: { density: "Low.", negativeSpaceRole: "Active.", visualBreathing: "Protected.", layering: "Minimal.", compression: "Supporting copy only.", expansion: "Around hero.", rhythm: "Measured." },
      graphicDeviceStrategy: "Repeat the approved device.", narrativeBehavior: "Direct reveal.", copyHierarchy: approvedHierarchy, messageRefsUsed: approvedMessageRefs, claimRefsUsed: [], brandConstraintRefsApplied: [], brandConstraintRefsPotentiallyViolated: [], adaptationActionRefs: [], referencePrincipleRefs: [], distinctiveAssetRefsUsed: [], brandExpression: "Declared assets remain recognizable.", referencePrinciplesUsed: [], adaptationActionsUsed: [], distinctiveAssetsUsed: [], antiClicheStrategy: ["Reject purposeless decoration."], antiAiStrategy: ["Keep physical coherence."],
      formatAdaptability: { score: 0.9, strengths: ["Modular"], risks: [], adaptationNotes: ["Preserve hierarchy"] }, productionFeasibility: 0.9,
      divergenceVector: { abstraction: values[0], humanFocus: values[1], productFocus: values[2], editoriality: values[3], dynamism: values[4], minimalism: values[5], dimensionality: values[6], narrativeDepth: values[7], typographicExpression: values[8] },
      confidence: 0.9, provenance: [{ decision: "Core idea", source: "creative_concept", confidence: 0.9 }], declaredHardViolations: [], inventedClaims: [], literalReferenceTraits: [], declaredBrandDriftTraits: [],
    });
    return {
      strategicFrame: { communicationProblem: "Communicate clearly.", communicationOpportunity: "Create memorable clarity.", singleMindedProposition: "Approved copy.", desiredResponse: "Understand and act.", messageHierarchy: approvedHierarchy, brandRole: "Respect brand.", referenceRole: "Transfer principles.", formatRole: "Adapt natively.", creativeOpportunity: "Differentiate coherently.", confidence: 0.9 },
      routes: [route("mock-a", [.05,.05,.05,.05,.05,.05,.05,.05,.05]), route("mock-b", [.05,.95,.05,.95,.05,.95,.05,.95,.05]), route("mock-c", [.95,.95,.95,.95,.95,.95,.95,.95,.95])],
    };
  }
  if (request.pass === "sol_critic")
    return {
      criticScore: 100,
      dimensions: {
        evidenceIntegrity: 100,
        compositionReasoning: 100,
        hierarchyReasoning: 100,
        typographicReasoning: 100,
        colorReasoning: 100,
        physicalPlausibility: 100,
        semanticSeparation: 100,
        antiAiDetection: 100,
        confidenceCalibration: 100,
      },
      issues: [],
      corrections: [],
      requiresRevision: false,
      confidence: 1,
    };
  if (request.pass === "raw_observation" || request.pass === "repair")
    return {
      canvas: {
        width: 1,
        height: 1,
        aspectRatio: 1,
        orientation: "square",
        visualCenter: { x: 0.5, y: 0.5 },
        opticalCenter: { point: { x: 0.5, y: 0.5 }, confidence: 0.9, evidenceIds: [] },
      },
      observations: [],
      regions: [],
    };
  if (request.pass === "spatial_relationships") return { relationships: [] };
  if (request.pass === "domain_analysis") return { materialAnalysis: [] };
  if (request.pass === "principle_inference")
    return { inferredPrinciples: [], antiAiFindings: [] };
  if (request.pass === "consistency_check")
    return {
      uncertainties: [],
      contradictions: [],
      evidenceQuality: {
        coverage: 0.9,
        consistency: 0.95,
        measurementSupport: 0.8,
        observationToInferenceRatio: 0.95,
        speculationRisk: 0.05,
        overall: 0.9,
      },
      overallConfidence: 0.9,
    };
  throw new Error(`No deterministic mock fixture registered for ${request.schemaName}.`);
};

/** Single server-side boundary for every structured AI provider. */
export const createStructuredAIProvider = (
  options: StructuredAIProviderFactoryOptions,
): AIProvider => {
  const provider: AIProvider = resolvePicaDesignerProviderMode(options.env) === "mock"
    ? new MockAIProvider(options.mockFactory ?? defaultMockResponse, {
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
      })
    : new OpenAIProvider(options.config);
  const instrumentation = options.instrumentation ?? testInstrumentation;
  return instrumentation
    ? new InstrumentedProvider(provider, instrumentation)
    : provider;
};
