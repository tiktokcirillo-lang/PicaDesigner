import express, { Router } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { applicationProjectRepository } from "../../infrastructure/project-persistence/index.js";
import {
  applicationProjectSourceAssetRepository,
  applicationProjectSourceAssetStore,
} from "../../infrastructure/source-assets/index.js";
import {
  allowedMediaTypesFor,
  createProjectSourceAssetRef,
  loadSourceAssetConfig,
  parseProjectSourceAssetRef,
  safeSourceAssetSummary,
  sourceExtension,
  type ProjectSourceAssetRole,
  type SourceAssetUploadDescriptor,
} from "../../domain/source-assets/index.js";
import {
  checkProjectSourceAssetUpload,
  finalizeProjectSourceAsset,
  reconcileProjectSourceAsset,
} from "../../application/source-assets/index.js";
const sourceError = (
  res: express.Response,
  status: number,
  code: string,
  error: string,
) => res.status(status).json({ code, error });
const roles = new Set<ProjectSourceAssetRole>([
    "visual_reference",
    "official_logo",
    "product_image",
    "brand_photo",
    "graphic_asset",
  ]),
  checksum = /^[a-f0-9]{64}$/;
const parseDescriptor = (value: string | null): SourceAssetUploadDescriptor => {
  const parsed = JSON.parse(
    value ?? "null",
  ) as Partial<SourceAssetUploadDescriptor>;
  if (
    !parsed.projectId ||
    !parsed.role ||
    !roles.has(parsed.role) ||
    !parsed.operationId ||
    !parsed.originalFilename ||
    !parsed.mediaType ||
    !Number.isInteger(parsed.byteSize) ||
    !parsed.checksum ||
    !checksum.test(parsed.checksum)
  )
    throw new Error("Invalid source upload authorization.");
  return parsed as SourceAssetUploadDescriptor;
};
export const createSourceAssetsRouter = () => {
  const router = Router(),
    config = loadSourceAssetConfig();
  router.post("/:projectId/source-assets/check", async (req, res) => {
    try {
      const projectId = req.params.projectId,
        descriptor = parseDescriptor(JSON.stringify(req.body));
      if (
        descriptor.projectId !== projectId ||
        !(await applicationProjectRepository.getProject(projectId))
      )
        return sourceError(
          res,
          404,
          "SOURCE_INVALID_FILE",
          "Projeto não encontrado.",
        );
      if (
        descriptor.byteSize > config.maxBytes ||
        !allowedMediaTypesFor(descriptor.role).includes(descriptor.mediaType)
      )
        return sourceError(
          res,
          400,
          "SOURCE_INVALID_FILE",
          "Arquivo inválido.",
        );
      const result = await checkProjectSourceAssetUpload(descriptor, {
        repository: applicationProjectSourceAssetRepository,
        store: applicationProjectSourceAssetStore,
        maxBytes: config.maxBytes,
        maxPixels: config.maxPixels,
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/invalid source upload authorization/i.test(message))
        return sourceError(
          res,
          400,
          "SOURCE_INVALID_FILE",
          "Arquivo inválido.",
        );
      if (/checksum|metadata mismatch|size mismatch|media type/i.test(message))
        return sourceError(
          res,
          409,
          "SOURCE_CHECKSUM_MISMATCH",
          "O arquivo armazenado não corresponde ao envio.",
        );
      if (/backing unavailable/i.test(message))
        return sourceError(
          res,
          409,
          "SOURCE_BACKING_UNAVAILABLE",
          "Arquivo indisponível após envio.",
        );
      return sourceError(
        res,
        503,
        "SOURCE_STORAGE_UNAVAILABLE",
        "Storage temporariamente indisponível.",
      );
    }
  });
  router.post("/:projectId/source-assets/upload", async (req, res) => {
    try {
      if (
        applicationProjectSourceAssetStore.kind !== "durable" ||
        !applicationProjectSourceAssetStore.capabilities.directClientUpload
      )
        return sourceError(
          res,
          503,
          "SOURCE_STORAGE_UNAVAILABLE",
          "Storage de upload indisponível.",
        );
      const result = await handleUpload({
        request: req,
        body: req.body as HandleUploadBody,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const descriptor = parseDescriptor(clientPayload);
          if (
            descriptor.projectId !== req.params.projectId ||
            !(await applicationProjectRepository.getProject(
              descriptor.projectId,
            ))
          )
            throw new Error("Project upload scope is invalid.");
          if (
            descriptor.byteSize > config.maxBytes ||
            !allowedMediaTypesFor(descriptor.role).includes(
              descriptor.mediaType,
            )
          )
            throw new Error("Source asset policy rejected the file.");
          const ext = sourceExtension(descriptor.mediaType);
          if (!ext) throw new Error("Unsupported source media type.");
          const expected = parseProjectSourceAssetRef(
            createProjectSourceAssetRef(
              descriptor.projectId,
              descriptor.checksum,
              ext,
            ),
            descriptor.projectId,
          ).pathname;
          if (pathname !== expected)
            throw new Error("Source upload pathname is outside its scope.");
          return {
            allowedContentTypes: allowedMediaTypesFor(descriptor.role),
            maximumSizeInBytes: config.maxBytes,
            validUntil: Date.now() + 5 * 60_000,
            addRandomSuffix: false,
            allowOverwrite: false,
            cacheControlMaxAge: 31536000,
            tokenPayload: JSON.stringify({
              projectId: descriptor.projectId,
              role: descriptor.role,
              checksum: descriptor.checksum,
            }),
          };
        },
      });
      return res.json(result);
    } catch {
      return sourceError(
        res,
        400,
        "SOURCE_UPLOAD_AUTH_FAILED",
        "Não foi possível autorizar o upload.",
      );
    }
  });
  router.post(
    "/:projectId/source-assets/direct",
    express.raw({
      type: "application/octet-stream",
      limit: `${Math.ceil(config.maxBytes / 1024 / 1024)}mb`,
    }),
    async (req, res) => {
      try {
        if (applicationProjectSourceAssetStore.kind !== "memory")
          return res.status(404).end();
        const role = String(
            req.headers["x-source-role"] ?? "",
          ) as ProjectSourceAssetRole,
          mediaType = String(req.headers["x-source-media-type"] ?? ""),
          expected = String(req.headers["x-source-checksum"] ?? ""),
          bytes = new Uint8Array(req.body as Buffer);
        if (!roles.has(role) || !checksum.test(expected))
          return sourceError(
            res,
            400,
            "SOURCE_INVALID_FILE",
            "Arquivo inválido.",
          );
        await applicationProjectSourceAssetStore.put({
          projectId: req.params.projectId,
          bytes,
          mediaType,
          checksum: expected,
        });
        return res.json({ uploaded: true });
      } catch {
        return sourceError(
          res,
          422,
          "SOURCE_CHECKSUM_MISMATCH",
          "O arquivo enviado falhou na validação.",
        );
      }
    },
  );
  router.post("/:projectId/source-assets/finalize", async (req, res) => {
    try {
      const projectId = req.params.projectId;
      if (!(await applicationProjectRepository.getProject(projectId)))
        return res.status(404).json({ error: "Project not found." });
      const body = req.body as Partial<SourceAssetUploadDescriptor> & {
        supersedesAssetId?: string;
      };
      if (
        body.projectId !== projectId ||
        !body.role ||
        !roles.has(body.role) ||
        !body.operationId ||
        !body.originalFilename ||
        !body.mediaType ||
        !body.byteSize ||
        !body.checksum
      )
        return sourceError(
          res,
          400,
          "SOURCE_INVALID_FILE",
          "Dados do arquivo inválidos.",
        );
      const asset = await finalizeProjectSourceAsset(
        {
          ...body,
          projectId,
          role: body.role,
          operationId: body.operationId,
          originalFilename: body.originalFilename,
          mediaType: body.mediaType,
          byteSize: body.byteSize,
          checksum: body.checksum,
          supersedesAssetId: body.supersedesAssetId,
        },
        {
          repository: applicationProjectSourceAssetRepository,
          store: applicationProjectSourceAssetStore,
          maxBytes: config.maxBytes,
          maxPixels: config.maxPixels,
        },
      );
      return res.status(201).json({ asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/not found|unavailable/i.test(message))
        return sourceError(
          res,
          409,
          "SOURCE_BACKING_UNAVAILABLE",
          "Arquivo indisponível após envio.",
        );
      if (/checksum|media type|size mismatch/i.test(message))
        return sourceError(
          res,
          422,
          "SOURCE_CHECKSUM_MISMATCH",
          "O arquivo enviado não corresponde ao esperado.",
        );
      return sourceError(
        res,
        422,
        "SOURCE_FINALIZE_FAILED",
        "Não foi possível concluir o upload.",
      );
    }
  });
  router.get("/:projectId/source-assets", async (req, res) => {
    try {
      const records =
          await applicationProjectSourceAssetRepository.listByProject(
            req.params.projectId,
          ),
        assets = [];
      for (const record of records) {
        const effective =
          record.status === "available"
            ? await reconcileProjectSourceAsset(
                record,
                applicationProjectSourceAssetStore,
              )
            : record;
        if (record.status === "available" && effective.status !== "available")
          await applicationProjectSourceAssetRepository.markUnavailable(
            record.projectId,
            record.assetId,
          );
        assets.push(safeSourceAssetSummary(effective));
      }
      return res.json({ assets });
    } catch {
      return res.status(503).json({ error: "Source assets are unavailable." });
    }
  });
  router.post(
    "/:projectId/source-assets/:assetId/read-handle",
    async (req, res) => {
      try {
        const asset = await applicationProjectSourceAssetRepository.get(
          req.params.projectId,
          req.params.assetId,
        );
        if (!asset)
          return res
            .status(404)
            .json({ error: "Este arquivo não pertence ao projeto." });
        const effective = await reconcileProjectSourceAsset(
          asset,
          applicationProjectSourceAssetStore,
        );
        if (
          effective.status !== "available" ||
          !applicationProjectSourceAssetStore.createReadHandle
        )
          return res
            .status(409)
            .json({ error: "O arquivo original não está mais disponível." });
        return res.json(
          await applicationProjectSourceAssetStore.createReadHandle(
            asset.backingRef,
            asset.projectId,
            asset.mediaType,
            config.ttlSeconds,
          ),
        );
      } catch {
        return res
          .status(404)
          .json({ error: "Source asset preview unavailable." });
      }
    },
  );
  return router;
};
