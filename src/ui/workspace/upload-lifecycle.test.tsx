import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { ProjectSourceAssetSummary } from "../../domain/source-assets/index.js";
import { SourceAssetField, type SourceAssetFieldState } from "../source-assets/SourceAssetField.js";
import { MountedWorkspacePanel } from "./MountedWorkspacePanel.js";
import { sourceUploadGenerationBlock } from "../state/workspace-logic.js";

let finishUpload: (() => void) | undefined;
let rejectUpload: ((error: Error) => void) | undefined;
let observedSignal: AbortSignal | undefined;
let finalizeCalls = 0;
let generationCalls = 0;
const durableAsset: ProjectSourceAssetSummary = {
  schemaVersion: "1.0.0",
  assetId: "asset-reference",
  projectId: "project-upload",
  role: "visual_reference",
  filename: "reference.png",
  originalFilename: "reference.png",
  mediaType: "image/png",
  byteSize: 4,
  checksum: "checksum-reference",
  width: 1080,
  height: 1080,
  status: "available",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("../../client/source-assets.js", () => ({
  uploadProjectSourceAsset: vi.fn((input: { signal?: AbortSignal; onProgress?: (state: SourceAssetFieldState) => void }) => {
    observedSignal = input.signal;
    input.onProgress?.("hashing");
    input.onProgress?.("checking");
    input.onProgress?.("uploading");
    return new Promise<ProjectSourceAssetSummary>((resolve, reject) => {
      finishUpload = () => {
        input.onProgress?.("finalizing");
        finalizeCalls += 1;
        resolve(durableAsset);
      };
      rejectUpload = reject;
    });
  }),
  getProjectSourceAssetReadHandle: vi.fn(async () => ({
    url: "blob:durable-preview",
    expiresAt: "2026-12-01T00:00:00.000Z",
    mediaType: "image/png",
  })),
  sourceAssetErrorMessage: vi.fn(() => "Não foi possível concluir o upload."),
}));

function Harness() {
  const [tab, setTab] = useState<"reference" | "format">("reference");
  const [asset, setAsset] = useState<ProjectSourceAssetSummary>();
  const [states, setStates] = useState<Record<string, SourceAssetFieldState>>({});
  const gate = sourceUploadGenerationBlock(states);
  return <>
    <button onClick={() => setTab("reference")}>Referência</button>
    <button onClick={() => setTab("format")}>Formato</button>
    <button disabled={gate.blocked} onClick={() => { generationCalls += 1; }}>Gerar pacote Meta Ads</button>
    {gate.pending ? <span>Aguarde a conclusão do upload.</span> : null}
    <MountedWorkspacePanel active={tab === "reference"}>
      <SourceAssetField
        fieldId="reference"
        projectId="project-upload"
        role="visual_reference"
        label="Adicionar referência visual"
        value={asset}
        onChange={setAsset}
        onError={() => undefined}
        onStateChange={(fieldId, state) =>
          setStates((current) => ({ ...current, [fieldId]: state }))
        }
      />
    </MountedWorkspacePanel>
    <MountedWorkspacePanel active={tab === "format"}><span>Formato ativo</span></MountedWorkspacePanel>
  </>;
}

afterEach(() => {
  cleanup();
  finishUpload = undefined;
  rejectUpload = undefined;
  observedSignal = undefined;
  finalizeCalls = 0;
  generationCalls = 0;
});

describe("durable source upload lifecycle", () => {
  it("survives tab changes, finalizes, enables generation and restores", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:local-preview",
      revokeObjectURL: () => undefined,
    });
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Adicionar referência visual"), {
      target: { files: [new File([new Uint8Array([1, 2, 3, 4])], "reference.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar pacote Meta Ads" }).hasAttribute("disabled")).toBe(true));
    expect(screen.getByText("Aguarde a conclusão do upload.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gerar pacote Meta Ads" }));
    expect(generationCalls).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Formato" }));
    expect(observedSignal?.aborted).toBe(false);
    finishUpload?.();
    await waitFor(() => expect(finalizeCalls).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar pacote Meta Ads" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Referência" }));
    expect(await screen.findByText("reference.png")).toBeTruthy();
    cleanup();
    render(<SourceAssetField projectId="project-upload" role="visual_reference" label="Adicionar referência visual" value={durableAsset} onChange={() => undefined} onError={() => undefined} />);
    expect(await screen.findByText("reference.png")).toBeTruthy();
  });

  it("keeps a failed attempt blocked until explicitly cleared", async () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:local-preview", revokeObjectURL: () => undefined });
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Adicionar referência visual"), {
      target: { files: [new File(["bad"], "reference.png", { type: "image/png" })] },
    });
    rejectUpload?.(new Error("finalize failed"));
    await waitFor(() => expect(screen.getByText("Falha no upload")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Gerar pacote Meta Ads" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Limpar tentativa" }));
    expect(screen.getByRole("button", { name: "Gerar pacote Meta Ads" }).hasAttribute("disabled")).toBe(false);
  });
});
