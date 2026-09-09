import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {VercelBlobProjectSourceAssetStore,SOURCE_ASSET_HEALTH_PROBE} from "./source-assets/vercel-blob-store.js";
import {VercelBlobGeneratedAssetStore,GENERATED_ASSET_HEALTH_PROBE} from "./image-generation/vercel-blob-store.js";
import {VercelBlobProductionArtifactStore,EXPORT_ARTIFACT_HEALTH_PROBE} from "./export-engine/vercel-blob-store.js";
const credentials={BLOB_READ_WRITE_TOKEN:"mock-token"},probes=[SOURCE_ASSET_HEALTH_PROBE,GENERATED_ASSET_HEALTH_PROBE,EXPORT_ARTIFACT_HEALTH_PROBE];
assert.deepEqual(probes,["health/picadesigner-source-assets-probe","health/picadesigner-generated-assets-probe","health/picadesigner-export-probe"]);assert(probes.every(path=>!path.includes("*")));
let calls=0;const issueToken=async(input:{pathname:string;operations:["head"]})=>{calls++;assert(probes.includes(input.pathname));assert.deepEqual(input.operations,["head"]);return"mock-signed-token"};
const healthy=[new VercelBlobProjectSourceAssetStore({env:credentials,issueToken}),new VercelBlobGeneratedAssetStore({env:credentials,issueToken}),new VercelBlobProductionArtifactStore({env:credentials,issueToken})];
for(const store of healthy)assert.equal((await store.health()).status,"ok");assert.equal(calls,3);
let missingCalls=0;const missingIssuer=async()=>{missingCalls++;return"unexpected"};for(const store of [new VercelBlobProjectSourceAssetStore({env:{},issueToken:missingIssuer}),new VercelBlobGeneratedAssetStore({env:{},issueToken:missingIssuer}),new VercelBlobProductionArtifactStore({env:{},issueToken:missingIssuer})])assert.equal((await store.health()).status,"degraded");assert.equal(missingCalls,0);
const failing=async()=>{throw new Error("mock auth failure")};for(const store of [new VercelBlobProjectSourceAssetStore({env:credentials,issueToken:failing}),new VercelBlobGeneratedAssetStore({env:credentials,issueToken:failing}),new VercelBlobProductionArtifactStore({env:credentials,issueToken:failing})])assert.equal((await store.health()).status,"degraded");
for(const file of ["source-assets/vercel-blob-store.ts","image-generation/vercel-blob-store.ts","export-engine/vercel-blob-store.ts"]){const source=await readFile(new URL(file,import.meta.url),"utf8"),health=source.slice(source.lastIndexOf("async health"));assert(!health.includes("put("));assert(!health.includes("del("));assert(!health.includes("head("));assert(!/pathname\s*:\s*["'`][^"'`]*\*/.test(health))}
console.log("Private Blob health validation passed: concrete read-only probes, credential and failure handling, and zero object writes.");
