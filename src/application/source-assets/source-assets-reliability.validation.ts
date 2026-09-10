import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  createMockSourceAssetDatabase,
  MockProjectSourceAssetRepository,
} from "../../infrastructure/source-assets/repository.js";
import {
  createMockSourceAssetBacking,
  MockDurableProjectSourceAssetStore,
} from "../../infrastructure/source-assets/store.js";
import {
  checkProjectSourceAssetUpload,
  finalizeProjectSourceAsset,
} from "./source-assets.js";

const bytes = new Uint8Array(
    await sharp({
      create: {
        width: 40,
        height: 30,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    })
      .png()
      .toBuffer(),
  ),
  checksum = createHash("sha256").update(bytes).digest("hex"),
  db = createMockSourceAssetDatabase(),
  backing = createMockSourceAssetBacking();
class CountingStore extends MockDurableProjectSourceAssetStore {
  puts = 0;
  override async put(
    input: Parameters<MockDurableProjectSourceAssetStore["put"]>[0],
  ) {
    this.puts += 1;
    return super.put(input);
  }
}
const store = new CountingStore(backing),
  repo = new MockProjectSourceAssetRepository(db),
  base = {
    projectId: "reliability",
    role: "visual_reference" as const,
    originalFilename: "foo.png",
    mediaType: "image/png",
    byteSize: bytes.byteLength,
    checksum,
  },
  deps = { repository: repo, store, maxBytes: 1e6, maxPixels: 1e6 };

assert.equal(
  (await checkProjectSourceAssetUpload(base, deps)).uploadRequired,
  true,
  "interrupted upload retries normally",
);
await store.put({
  projectId: base.projectId,
  bytes,
  mediaType: base.mediaType,
  checksum,
});
db.available = false;
await assert.rejects(() =>
  finalizeProjectSourceAsset({ ...base, operationId: "same-operation" }, deps),
);
db.available = true;
const orphan = await checkProjectSourceAssetUpload(base, deps);
assert.equal(orphan.recovery, "orphan_backing");
assert.equal(orphan.uploadRequired, false, "orphan Blob skips overwrite");
const recovered = await finalizeProjectSourceAsset(
  { ...base, operationId: "same-operation" },
  deps,
);
assert.equal(store.puts, 1, "same-file retry performs one byte upload");
const repeated = await checkProjectSourceAssetUpload(base, deps);
assert.equal(repeated.recovery, "metadata");
assert.equal(
  repeated.asset?.assetId,
  recovered.assetId,
  "completed duplicate reuses metadata",
);
const idempotent = await finalizeProjectSourceAsset(
  { ...base, operationId: "same-operation", originalFilename: "bar.png" },
  deps,
);
assert.equal(idempotent.assetId, recovered.assetId, "finalize is idempotent");
assert.equal(
  idempotent.filename,
  "foo.png",
  "physical dedupe preserves the first canonical filename",
);
await repo.markUnavailable(base.projectId, recovered.assetId);
const restored = await finalizeProjectSourceAsset(
  { ...base, operationId: "retry-after-unavailable" },
  deps,
);
assert.equal(
  restored.status,
  "available",
  "valid backing restores unavailable metadata",
);
const product = await finalizeProjectSourceAsset(
  { ...base, role: "product_image", operationId: "product-operation" },
  deps,
);
assert.notEqual(
  product.assetId,
  recovered.assetId,
  "same bytes retain role-specific semantic records",
);
assert.equal(
  (await repo.listByProject(base.projectId)).length,
  2,
  "one active record per semantic role",
);
const bytesB = new Uint8Array(
    await sharp({
      create: {
        width: 41,
        height: 30,
        channels: 4,
        background: { r: 11, g: 21, b: 31, alpha: 1 },
      },
    })
      .png()
      .toBuffer(),
  ),
  checksumB = createHash("sha256").update(bytesB).digest("hex");
await store.put({
  projectId: base.projectId,
  bytes: bytesB,
  mediaType: "image/png",
  checksum: checksumB,
});
await finalizeProjectSourceAsset(
  {
    ...base,
    checksum: checksumB,
    byteSize: bytesB.byteLength,
    operationId: "other-file",
  },
  deps,
);
assert.equal(
  (await repo.listByProject(base.projectId)).length,
  3,
  "different file creates independent asset",
);
const client = await readFile(
    new URL("../../client/source-assets.ts", import.meta.url),
    "utf8",
  ),
  field = await readFile(
    new URL("../../ui/source-assets/SourceAssetField.tsx", import.meta.url),
    "utf8",
  ),
  blob = await readFile(
    new URL(
      "../../infrastructure/source-assets/vercel-blob-store.ts",
      import.meta.url,
    ),
    "utf8",
  );
assert(
  !client.includes("/api/health/source-asset-store"),
  "upload does not depend on health endpoint",
);
assert(
  client.includes("source-assets/check"),
  "pre-upload reuse check is used",
);
assert(
  /input\.value\s*=\s*["']{2}/.test(field),
  "file input resets after every attempt",
);
for (const state of [
  "hashing",
  "checking",
  "uploading",
  "finalizing",
  "available",
  "failed",
])
  assert(field.includes(state), `state ${state} is represented`);
assert(
  /allowOverwrite\s*:\s*false/.test(blob),
  "immutable Blob overwrite remains disabled",
);
console.log(
  "Source asset reliability validation passed: orphan recovery, byte dedupe, role isolation, retry, state UX and immutable Blob storage.",
);
