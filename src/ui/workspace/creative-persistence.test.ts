import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DRAFT } from "../state/workspace-types.js";

const mocks = vi.hoisted(() => ({
  saveDurableCheckpoint: vi.fn(async (input: { expectedRevision: number; stage: string; payload: unknown }) => ({
    project: { revision: input.expectedRevision + 1 },
  })),
  ensureCreativeDirection: vi.fn(),
}));
const failedCreative = {
  schemaVersion: "1.1.0",
  sessionId: "creative-failed",
  projectId: "project-creative",
  inputFingerprint: "creative-fingerprint",
  status: "failed",
  failureReason: "no_eligible_route",
  routes: [{ id: "route-a" }, { id: "route-b" }, { id: "route-c" }],
  evaluations: [
    { routeId: "route-a", eligible: false, gateFailures: ["invented_claim"] },
    { routeId: "route-b", eligible: false, gateFailures: ["brand_drift"] },
    { routeId: "route-c", eligible: false, gateFailures: ["communication_fit"] },
  ],
  quality: { routeDiversity: 0.4, overall: 0.3 },
  warnings: [],
  cost: 0.08,
  aiUsage: { inputTokens: 10, outputTokens: 10 },
};
mocks.ensureCreativeDirection.mockResolvedValue(failedCreative);

vi.mock("../../client/project-persistence.js", () => ({ saveDurableCheckpoint: mocks.saveDurableCheckpoint }));
vi.mock("../../client/creative-direction.js", () => ({ ensureCreativeDirection: mocks.ensureCreativeDirection }));
vi.mock("../../client/reference-intelligence.js", () => ({ analyzeDurableVisualReference: vi.fn() }));
vi.mock("../../client/layout-intelligence.js", () => ({ ensureLayoutIntelligence: vi.fn() }));
vi.mock("../../client/art-director-review.js", () => ({ ensureArtDirectorReview: vi.fn() }));
vi.mock("../../client/render-session.js", () => ({ ensureRenderSession: vi.fn() }));
vi.mock("../../client/image-assets.js", () => ({ ensureImageAssets: vi.fn() }));
vi.mock("../../client/post-render-review.js", () => ({ ensurePostRenderReview: vi.fn() }));
vi.mock("../../client/campaign-variants.js", () => ({ createCampaignFamily: vi.fn(), runCampaignFamily: vi.fn() }));

import { runDesignPipeline } from "./pipeline-controller.js";

describe("creative failure durability", () => {
  it("persists a paid failed session before stopping production", async () => {
    await expect(
      runDesignPipeline({
        projectId: "project-creative",
        revision: 1,
        draft: { ...DEFAULT_DRAFT, copyText: "Approved copy" },
        snapshot: {
          project: { projectId: "project-creative", revision: 1 },
          workflow: {},
          activeAssetResolutions: [],
          exports: [],
        } as never,
        onStage: vi.fn(),
      }),
    ).rejects.toThrow("Nenhuma rota passou pelos critérios de direção criativa.");
    const creativeSave = mocks.saveDurableCheckpoint.mock.calls
      .map(([input]) => input)
      .find((input) => input.stage === "creative_direction");
    expect(creativeSave?.payload).toBe(failedCreative);
    expect(mocks.saveDurableCheckpoint.mock.calls.some(([input]) => input.stage === "layout")).toBe(false);
  });
});
