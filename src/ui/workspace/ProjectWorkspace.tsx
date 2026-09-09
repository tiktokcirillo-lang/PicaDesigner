import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Play, RefreshCw, Save } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { SafeProjectState } from "../../domain/project-persistence/index.js";
import { ApiClientError } from "../../client/api-response.js";
import { listProjectSourceAssets } from "../../client/source-assets.js";
import type { ProjectSourceAssetSummary } from "../../domain/source-assets/index.js";
import {
  getProjectState,
  saveDurableCheckpoint,
  updateProject,
} from "../../client/project-persistence.js";
import { resolveFormatDefinition } from "../../domain/layout-engine/formats.js";
import { Button } from "../primitives/Button.js";
import { Badge, ErrorState, Skeleton } from "../primitives/Status.js";
import { BriefPanel } from "../briefing/BriefPanel.js";
import { ReferencePanel } from "../references/ReferencePanel.js";
import { BrandPanel } from "../brand/BrandPanel.js";
import { FormatSelector, formatLabel } from "../formats/FormatSelector.js";
import { PipelineTimeline } from "../pipeline/PipelineTimeline.js";
import { ArtboardViewport } from "../preview/ArtboardViewport.js";
import { ExportPanel } from "../export/ExportPanel.js";
import {
  DEFAULT_DRAFT,
  type PipelineStageId,
  type RightTab,
  type WorkspaceDraft,
  type WorkspaceTab,
} from "../state/workspace-types.js";
import {
  fingerprintWorkspaceInput,
  pipelineFromSnapshot,
  toWorkspaceInput,
} from "../state/workspace-logic.js";
import { runDesignPipeline } from "./pipeline-controller.js";
import { useToast } from "../primitives/Toast.js";
const leftTabs: [WorkspaceTab, string][] = [
    ["briefing", "Briefing"],
    ["reference", "Referência"],
    ["brand", "Marca"],
    ["format", "Formato"],
  ],
  rightTabs: [RightTab, string][] = [
    ["pipeline", "Pipeline"],
    ["details", "Detalhes"],
    ["export", "Export"],
  ];
function restoredDraft(state: SafeProjectState, assets: ProjectSourceAssetSummary[]): WorkspaceDraft {
  const input = state.workflow.workspace_input as Record<string, unknown> | undefined;
  const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
  const ids = (key: string) => Array.isArray(input?.[key]) ? (input?.[key] as string[]).map((id) => byId.get(id)).filter((asset): asset is ProjectSourceAssetSummary => Boolean(asset)) : [];
  return {
    ...DEFAULT_DRAFT,
    ...(input as Partial<WorkspaceDraft>),
    referenceAsset: typeof input?.referenceAssetId === "string" ? byId.get(input.referenceAssetId) : undefined,
    logoAsset: typeof input?.logoAssetId === "string" ? byId.get(input.logoAssetId) : undefined,
    productAssets: ids("productAssetIds"),
    brandPhotoAssets: ids("brandPhotoAssetIds"),
    graphicAssets: ids("graphicAssetIds"),
  };
}
export function ProjectWorkspace() {
  const { projectId = "" } = useParams(),
    [snapshot, setSnapshot] = useState<SafeProjectState>(),
    [draft, setDraft] = useState<WorkspaceDraft>(DEFAULT_DRAFT),
    [leftTab, setLeftTab] = useState<WorkspaceTab>("briefing"),
    [rightTab, setRightTab] = useState<RightTab>("pipeline"),
    [saveStatus, setSaveStatus] = useState<
      "idle" | "saving" | "saved" | "conflict" | "error"
    >("idle"),
    [error, setError] = useState(""),
    [pipeline, setPipeline] = useState(
      () =>
        ({
          running: false,
          stages: {
            preparation: "ready",
            reference: "idle",
            creative: "idle",
            layout: "idle",
            review: "idle",
            production: "idle",
            qa: "idle",
            delivery: "blocked",
          },
        }) as ReturnType<typeof pipelineFromSnapshot>,
    ),
    [zoom, setZoom] = useState(0),
    [showSafeArea, setShowSafeArea] = useState(false),
    [showGrid, setShowGrid] = useState(false),
    [scene] = useState(0),
    revision = useRef(0),
    hydrated = useRef(false),
    { notify } = useToast();
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError("");
        const [state, sourceAssets] = await Promise.all([
          getProjectState(projectId, signal),
          listProjectSourceAssets(projectId, signal),
        ]);
        setSnapshot(state);
        setDraft(restoredDraft(state, sourceAssets.assets));
        setPipeline(pipelineFromSnapshot(state));
        revision.current = state.project.revision;
        hydrated.current = true;
        document.title = `${state.project.name === "Untitled Project" ? "Projeto sem título" : state.project.name} — PicaDesigner`;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Não foi possível restaurar o projeto pelo servidor.");
      }
    },
    [projectId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(
    () => () => {
      document.title = "PicaDesigner — AI Design Studio";
    },
    [],
  );
  useEffect(() => {
    if (!snapshot || !hydrated.current) return;
    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const input = toWorkspaceInput(draft),
          fingerprint = await fingerprintWorkspaceInput(input),
          saved = await saveDurableCheckpoint({
            projectId,
            versionId: snapshot.activeVersionId ?? `version:${projectId}`,
            stage: "workspace_input",
            operationId: `workspace_input:${fingerprint}`,
            fingerprint,
            expectedRevision: revision.current,
            payload: input,
          });
        revision.current = saved.project.revision;
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus(
          e instanceof ApiClientError && e.status === 409
            ? "conflict"
            : "error",
        );
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draft, projectId, snapshot]);
  const format = useMemo(() => {
    try {
      return draft.formatId === "custom"
        ? resolveFormatDefinition({
            width: draft.customWidth ?? 1080,
            height: draft.customHeight ?? 1080,
          })
        : resolveFormatDefinition(draft.formatId);
    } catch {
      return resolveFormatDefinition("meta_ads_square");
    }
  }, [draft.formatId, draft.customWidth, draft.customHeight]);
  const hasRender = Boolean(snapshot?.workflow.render_session),
    approved = snapshot?.latestProductionAuthority?.status === "valid";
  function change(patch: Partial<WorkspaceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (snapshot?.workflow.render_session)
      setPipeline((current) => ({
        ...current,
        stages: {
          ...current.stages,
          creative: "stale",
          layout: "stale",
          review: "stale",
          production: "stale",
          qa: "stale",
          delivery: "blocked",
        },
      }));
  }
  async function generate() {
    if (!snapshot || pipeline.running) return;
    if (!draft.copyText.trim() && !draft.referenceAsset) {
      setError("Adicione uma copy ou referência antes de gerar.");
      return;
    }
    setError("");
    setRightTab("pipeline");
    setPipeline((current) => ({ ...current, running: true, error: undefined }));
    try {
      await runDesignPipeline({
        projectId,
        revision: revision.current,
        draft,
        snapshot,
        onStage: (stage: PipelineStageId) =>
          setPipeline((current) => ({
            ...current,
            active: stage,
            stages: { ...current.stages, [stage]: "running" },
          })),
      });
      notify("Pipeline concluído");
      await load();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Não foi possível concluir o pipeline.";
      setError(message);
      setPipeline((current) => ({
        ...current,
        running: false,
        error: message,
        stages: {
          ...current.stages,
          [current.active ?? "preparation"]: "failed",
        },
      }));
    }
  }
  async function rename() {
    if (!snapshot) return;
    const name = window.prompt(
      "Nome do projeto",
      snapshot.project.name === "Untitled Project" ? "" : snapshot.project.name,
    );
    if (name === null) return;
    try {
      const result = await updateProject({
        projectId,
        expectedRevision: revision.current,
        name,
      });
      revision.current = result.project.revision;
      setSnapshot((current) =>
        current ? { ...current, project: result.project } : current,
      );
      notify("Nome atualizado");
    } catch (e) {
      setSaveStatus(
        e instanceof ApiClientError && e.status === 409 ? "conflict" : "error",
      );
    }
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void generate();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        setDraft((current) => ({ ...current }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  if (error && !snapshot)
    return <ErrorState message={error} onRetry={() => void load()} />;
  if (!snapshot)
    return (
      <div className="workspace-loading">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  return (
    <div className="workspace">
      <header className="workspace-header">
        <div>
          <button className="project-title" onClick={rename}>
            {snapshot.project.name === "Untitled Project"
              ? "Projeto sem título"
              : snapshot.project.name}
          </button>
          <span>
            {formatLabel(format.id)} · {format.width}×{format.height}
          </span>
        </div>
        <div className="workspace-header__actions">
          <span className={`save-state save-state--${saveStatus}`}>
            <Save size={13} />
            {saveStatus === "saving"
              ? "Salvando…"
              : saveStatus === "saved"
                ? "Salvo"
                : saveStatus === "conflict"
                  ? "Conflito"
                  : saveStatus === "error"
                    ? "Erro ao sincronizar"
                    : "Sincronizado"}
          </span>
          <Link
            className="button button--ghost"
            to={`/projects/${projectId}/history`}
          >
            <History size={15} />
            Histórico
          </Link>
          <Button disabled={pipeline.running} onClick={generate}>
            {pipeline.running ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Play size={16} />
            )}{" "}
            {hasRender ? "Atualizar design" : "Gerar design"}
          </Button>
        </div>
      </header>
      {saveStatus === "conflict" ? (
        <div className="conflict-banner" role="alert">
          Este projeto foi atualizado em outra sessão.{" "}
          <button onClick={() => void load()}>
            Recarregar versão do servidor
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="workspace-error" role="alert">
          {error}
        </div>
      ) : null}
      <aside className="input-panel">
        <nav className="panel-tabs">
          {leftTabs.map(([id, label]) => (
            <button
              className={leftTab === id ? "active" : ""}
              key={id}
              onClick={() => setLeftTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="panel-scroll">
          {leftTab === "briefing" ? (
            <BriefPanel draft={draft} onChange={change} />
          ) : leftTab === "reference" ? (
            <ReferencePanel
              projectId={projectId}
              draft={draft}
              onChange={change}
              onError={setError}
            />
          ) : leftTab === "brand" ? (
            <BrandPanel projectId={projectId} draft={draft} onChange={change} onError={setError} />
          ) : (
            <FormatSelector draft={draft} onChange={change} />
          )}
        </div>
      </aside>
      <ArtboardViewport
        projectId={projectId}
        hasRender={hasRender}
        approved={approved}
        formatId={format.id}
        ratio={format.aspectRatio}
        scene={scene}
        zoom={zoom}
        showGrid={showGrid}
        showSafeArea={showSafeArea}
        onChange={(patch) => {
          if (patch.zoom !== undefined) setZoom(patch.zoom);
          if (patch.showGrid !== undefined) setShowGrid(patch.showGrid);
          if (patch.showSafeArea !== undefined)
            setShowSafeArea(patch.showSafeArea);
        }}
      />
      <aside className="context-panel">
        <nav className="panel-tabs">
          {rightTabs.map(([id, label]) => (
            <button
              className={rightTab === id ? "active" : ""}
              key={id}
              onClick={() => setRightTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="panel-scroll">
          {rightTab === "pipeline" ? (
            <PipelineTimeline pipeline={pipeline} />
          ) : rightTab === "export" ? (
            <ExportPanel projectId={projectId} state={snapshot} />
          ) : (
            <div className="details-list">
              <section>
                <span>Status</span>
                <Badge tone={approved ? "success" : "info"}>
                  {approved ? "Aprovado" : "Em produção"}
                </Badge>
              </section>
              <section>
                <span>Formato</span>
                <strong>{format.label}</strong>
                <small>
                  {format.width}×{format.height}
                </small>
              </section>
              <section>
                <span>QA visual</span>
                <strong>
                  {approved
                    ? "Aprovado pela authority"
                    : "Aguardando aprovação"}
                </strong>
              </section>
              <details>
                <summary>Especificação e diagnostics</summary>
                <pre>
                  {JSON.stringify(
                    {
                      revision: snapshot.project.revision,
                      workflow: Object.keys(snapshot.workflow),
                      authority:
                        snapshot.latestProductionAuthority?.status ?? "none",
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
