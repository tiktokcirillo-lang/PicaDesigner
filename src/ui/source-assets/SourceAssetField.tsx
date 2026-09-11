import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { FileImage, UploadCloud, X } from "lucide-react";
import type {
  ProjectSourceAssetRole,
  ProjectSourceAssetSummary,
} from "../../domain/source-assets/index.js";
import {
  getProjectSourceAssetReadHandle,
  sourceAssetErrorMessage,
  uploadProjectSourceAsset,
  type SourceAssetUploadState,
} from "../../client/source-assets.js";
import { IconButton } from "../primitives/Button.js";

export type SourceAssetFieldState =
  | "idle"
  | SourceAssetUploadState
  | "available"
  | "failed";
const stateLabel: Record<SourceAssetFieldState, string> = {
  idle: "",
  hashing: "Preparando arquivo",
  checking: "Verificando arquivo existente",
  uploading: "Enviando arquivo",
  finalizing: "Concluindo upload",
  available: "Disponível",
  failed: "Falha no upload",
};

export function SourceAssetField({
  projectId,
  role,
  label,
  value,
  onChange,
  onError,
  fieldId = role,
  onStateChange,
}: {
  projectId: string;
  role: ProjectSourceAssetRole;
  label: string;
  value?: ProjectSourceAssetSummary;
  onChange: (asset: ProjectSourceAssetSummary | undefined) => void;
  onError: (message: string) => void;
  fieldId?: string;
  onStateChange?: (fieldId: string, state: SourceAssetFieldState) => void;
}) {
  const [state, setStateValue] = useState<SourceAssetFieldState>(
      value?.status === "available" ? "available" : "idle",
    ),
    [preview, setPreview] = useState(""),
    localUrl = useRef(""),
    activeUpload = useRef<AbortController | undefined>(undefined),
    mounted = useRef(true);
  const setState = (next: SourceAssetFieldState) => {
    setStateValue(next);
    onStateChange?.(fieldId, next);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeUpload.current?.abort();
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, [projectId]);
  useEffect(() => {
    const controller = new AbortController();
    if (!value) {
      if (!localUrl.current) setPreview("");
      return () => controller.abort();
    }
    getProjectSourceAssetReadHandle(projectId, value.assetId, controller.signal)
      .then((handle) => {
        if (mounted.current) setPreview(handle.url);
      })
      .catch(() => {
        if (mounted.current && !localUrl.current) setPreview("");
      });
    return () => controller.abort();
  }, [projectId, value?.assetId]);
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget,
      file = input.files?.[0];
    if (!file) return;
    activeUpload.current?.abort();
    const controller = new AbortController();
    activeUpload.current = controller;
    const previousPreview = preview;
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = URL.createObjectURL(file);
    setPreview(localUrl.current);
    try {
      const asset = await uploadProjectSourceAsset({
        projectId,
        role,
        file,
        supersedesAssetId: value?.assetId,
        signal: controller.signal,
        onProgress: (next) => {
          if (mounted.current && activeUpload.current === controller)
            setState(next);
        },
      });
      if (!mounted.current || activeUpload.current !== controller) return;
      if (asset.status !== "available")
        throw new Error("Source asset backing was not durably finalized.");
      onChange(asset);
      setState("available");
      if (localUrl.current) {
        URL.revokeObjectURL(localUrl.current);
        localUrl.current = "";
      }
      try {
        const handle = await getProjectSourceAssetReadHandle(
          projectId,
          asset.assetId,
          controller.signal,
        );
        if (mounted.current) setPreview(handle.url);
      } catch {
        if (mounted.current) setPreview("");
      }
    } catch (error) {
      if (!mounted.current || activeUpload.current !== controller) return;
      setState("failed");
      setPreview(previousPreview);
      onError(sourceAssetErrorMessage(error));
    } finally {
      input.value = "";
      if (activeUpload.current === controller) activeUpload.current = undefined;
    }
  }
  function clearAttempt() {
    activeUpload.current?.abort();
    activeUpload.current = undefined;
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = "";
    setPreview("");
    setState("idle");
    onChange(undefined);
  }
  return (
    <div className="source-field">
      <span className="field__label">{label}</span>
      {value ? (
        <div className="file-ready">
          {preview ? <img src={preview} alt="" /> : <FileImage />}
          <div>
            <strong>{value.filename}</strong>
            <span>
              {value.width}×{value.height} ·{" "}
              {(value.byteSize / 1024 / 1024).toFixed(1)} MB ·{" "}
              {value.status === "available" ? "Disponível" : "Indisponível"}
            </span>
          </div>
          <IconButton
            label={`Remover ${label}`}
            onClick={clearAttempt}
          >
            <X size={16} />
          </IconButton>
        </div>
      ) : (
        <label className="dropzone">
          {preview ? (
            <img
              className="source-local-preview"
              src={preview}
              alt="Prévia local"
            />
          ) : (
            <UploadCloud size={22} />
          )}
          <strong>{label}</strong>
          <span>JPEG, PNG ou WebP · até 20 MB</span>
          <input
            aria-label={label}
            type="file"
            accept="image/jpeg,image/png,image/webp"
              onChange={select}
          />
        </label>
      )}
      {stateLabel[state] ? (
        <span className={`upload-state upload-state--${state}`}>
          {stateLabel[state]}
        </span>
      ) : null}
      {state === "failed" && !value ? (
        <button type="button" className="button button--ghost" onClick={clearAttempt}>
          Limpar tentativa
        </button>
      ) : null}
    </div>
  );
}
