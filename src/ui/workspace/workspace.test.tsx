import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProjectCard } from "../dashboard/ProjectCard.js";
import { FormatSelector, formatLabel } from "../formats/FormatSelector.js";
import { PipelineTimeline } from "../pipeline/PipelineTimeline.js";
import { ExportPanel } from "../export/ExportPanel.js";
import { DEFAULT_DRAFT } from "../state/workspace-types.js";
import {
  deriveProjectWorkspaceStatus,
  formatContextFor,
  resolveWorkflowInvalidation,
  toWorkspaceInput,
} from "../state/workspace-logic.js";
import type { SafeProjectState } from "../../domain/project-persistence/index.js";
afterEach(cleanup);
const project = {
  projectId: "project_server",
  name: "Campanha",
  schemaVersion: "1.0.0",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  status: "active",
  revision: 3,
} as const;
describe("workspace logic", () => {
  it("preserves canonical Meta context and invalidation", () => {
    expect(formatContextFor("meta_ads_square")).toEqual({
      platform: "meta",
      usage: "advertising",
    });
    expect(toWorkspaceInput(DEFAULT_DRAFT)).not.toHaveProperty("reference");
    expect(resolveWorkflowInvalidation("format")[0]).toBe("layout");
    expect(formatLabel("meta_ads_story_reels")).toContain("Meta Ads");
  });
  it("derives authority-backed status", () => {
    expect(
      deriveProjectWorkspaceStatus({
        project,
        workflow: { workspace_input: {} },
        exports: [],
      }),
    ).toBe("Configurando");
    expect(
      deriveProjectWorkspaceStatus({
        project,
        latestProductionAuthority: { status: "valid" },
        exports: [{}],
      }),
    ).toBe("Pronto para exportar");
  });
});
describe("workspace components", () => {
  it("renders a project card", () => {
    render(
      <MemoryRouter>
        <ProjectCard project={project} onArchive={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Campanha")).toBeTruthy();
    expect(screen.getByRole("link", { name: /abrir/i })).toBeTruthy();
  });
  it("selects canonical formats", async () => {
    const change = vi.fn();
    render(<FormatSelector draft={DEFAULT_DRAFT} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: /Vertical Feed/i }));
    expect(change).toHaveBeenCalledWith({ formatId: "meta_ads_feed_portrait" });
  });
  it("shows actual stages without fake percentages", () => {
    render(
      <PipelineTimeline
        pipeline={{
          running: false,
          stages: {
            preparation: "approved",
            reference: "idle",
            creative: "idle",
            layout: "idle",
            review: "idle",
            production: "idle",
            qa: "idle",
            delivery: "blocked",
          },
        }}
      />,
    );
    expect(screen.getByText("Preparação")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("gates export before approval", () => {
    const state = {
      project,
      workflow: {},
      activeAssetResolutions: [],
      exports: [],
    } as SafeProjectState;
    render(<ExportPanel projectId={project.projectId} state={state} />);
    expect(screen.getByText("Exportação bloqueada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "PNG" })).toBeNull();
  });
});
