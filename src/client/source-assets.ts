import { upload } from "@vercel/blob/client";
import type {
  ProjectSourceAssetRole,
  ProjectSourceAssetSummary,
  SourceAssetUploadCheck,
  SourceAssetUploadDescriptor,
  SourceAssetUploadErrorCode,
} from "../domain/source-assets/index.js";
import { ApiClientError, parseApiResponse } from "./api-response.js";

const MAX_BYTES = 20 * 1024 * 1024,
  MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);
const sha256 = async (file: File) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
};
const extension = (mediaType: string) =>
  mediaType === "image/jpeg"
    ? "jpg"
    : mediaType === "image/webp"
      ? "webp"
      : "png";
export type SourceAssetUploadState =
  "hashing" | "checking" | "uploading" | "finalizing";

const safeUploadError = (error: unknown, phase: SourceAssetUploadState) => {
  if (
    error instanceof ApiClientError ||
    (error instanceof DOMException && error.name === "AbortError")
  )
    return error;
  const conflict =
    phase === "uploading" &&
    error instanceof Error &&
    /conflict|already exists|\b409\b/i.test(error.message);
  const code: SourceAssetUploadErrorCode = conflict
    ? "SOURCE_UPLOAD_CONFLICT"
    : phase === "uploading"
      ? "SOURCE_UPLOAD_FAILED"
      : "SOURCE_FINALIZE_FAILED";
  return new ApiClientError(
    conflict
      ? "O arquivo já existe e será recuperado na próxima tentativa."
      : phase === "uploading"
        ? "Não foi possível enviar o arquivo."
        : "Não foi possível concluir o upload.",
    conflict ? 409 : phase === "uploading" ? 503 : 422,
    code,
  );
};

export async function uploadProjectSourceAsset(input: {
  projectId: string;
  role: ProjectSourceAssetRole;
  file: File;
  operationId?: string;
  supersedesAssetId?: string;
  signal?: AbortSignal;
  onProgress?: (state: SourceAssetUploadState) => void;
}) {
  if (
    !MEDIA.has(input.file.type) ||
    input.file.size <= 0 ||
    input.file.size > MAX_BYTES
  )
    throw new ApiClientError(
      "Use JPEG, PNG ou WebP de até 20 MB.",
      400,
      "SOURCE_INVALID_FILE",
    );
  input.onProgress?.("hashing");
  const checksum = await sha256(input.file),
    descriptor: SourceAssetUploadDescriptor = {
      projectId: input.projectId,
      role: input.role,
      operationId: input.operationId ?? `source:${input.role}:${checksum}`,
      originalFilename: input.file.name,
      mediaType: input.file.type,
      byteSize: input.file.size,
      checksum,
    };
  let phase: SourceAssetUploadState = "checking";
  try {
    input.onProgress?.(phase);
    const check = await parseApiResponse<SourceAssetUploadCheck>(
      await fetch(
        `/api/projects/${encodeURIComponent(input.projectId)}/source-assets/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(descriptor),
          signal: input.signal,
        },
      ),
    );
    if (check.uploadRequired) {
      phase = "uploading";
      input.onProgress?.(phase);
      if (check.storeKind === "memory")
        await parseApiResponse(
          await fetch(
            `/api/projects/${encodeURIComponent(input.projectId)}/source-assets/direct`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "X-Source-Role": input.role,
                "X-Source-Media-Type": input.file.type,
                "X-Source-Checksum": checksum,
              },
              body: input.file,
              signal: input.signal,
            },
          ),
        );
      else if (check.storeKind === "durable")
        await upload(
          `projects/${input.projectId}/source-assets/${checksum}.${extension(input.file.type)}`,
          input.file,
          {
            access: "private",
            handleUploadUrl: `/api/projects/${encodeURIComponent(input.projectId)}/source-assets/upload`,
            clientPayload: JSON.stringify(descriptor),
            contentType: input.file.type,
            multipart: input.file.size > 5 * 1024 * 1024,
            abortSignal: input.signal,
          },
        );
      else
        throw new ApiClientError(
          "Storage temporariamente indisponível.",
          503,
          "SOURCE_STORAGE_UNAVAILABLE",
        );
    }
    phase = "finalizing";
    input.onProgress?.(phase);
    const result = await parseApiResponse<{ asset: ProjectSourceAssetSummary }>(
      await fetch(
        `/api/projects/${encodeURIComponent(input.projectId)}/source-assets/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...descriptor,
            supersedesAssetId: input.supersedesAssetId,
          }),
          signal: input.signal,
        },
      ),
    );
    return result.asset;
  } catch (error) {
    throw safeUploadError(error, phase);
  }
}

export const sourceAssetErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError")
    return "Upload interrompido.";
  const code = error instanceof ApiClientError ? error.code : undefined;
  return (
    (
      {
        SOURCE_INVALID_FILE: "Arquivo inválido.",
        SOURCE_UPLOAD_AUTH_FAILED: "Não foi possível autorizar o envio.",
        SOURCE_UPLOAD_FAILED: "Não foi possível enviar o arquivo.",
        SOURCE_UPLOAD_CONFLICT:
          "Upload interrompido. Tente o mesmo arquivo novamente.",
        SOURCE_FINALIZE_FAILED: "Não foi possível concluir o upload.",
        SOURCE_BACKING_UNAVAILABLE: "Arquivo indisponível após envio.",
        SOURCE_CHECKSUM_MISMATCH:
          "O arquivo enviado não corresponde ao esperado.",
        SOURCE_STORAGE_UNAVAILABLE: "Storage temporariamente indisponível.",
      } satisfies Record<SourceAssetUploadErrorCode, string>
    )[code as SourceAssetUploadErrorCode] ??
    "Não foi possível enviar o arquivo."
  );
};
export const listProjectSourceAssets = async (
  projectId: string,
  signal?: AbortSignal,
) =>
  parseApiResponse<{ assets: ProjectSourceAssetSummary[] }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/source-assets`,
      { signal },
    ),
  );
export const getProjectSourceAssetReadHandle = async (
  projectId: string,
  assetId: string,
  signal?: AbortSignal,
) =>
  parseApiResponse<{ url: string; expiresAt: string; mediaType: string }>(
    await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/source-assets/${encodeURIComponent(assetId)}/read-handle`,
      { method: "POST", signal },
    ),
  );
