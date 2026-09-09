import {upload} from "@vercel/blob/client";
import type {ProjectSourceAssetRole,ProjectSourceAssetSummary,SourceAssetUploadDescriptor} from "../domain/source-assets/index.js";
import {parseApiResponse} from "./api-response.js";
const MAX_BYTES=20*1024*1024,MEDIA=new Set(["image/jpeg","image/png","image/webp"]);
const sha256=async(file:File)=>{const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());return[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")};
const extension=(mediaType:string)=>mediaType==="image/jpeg"?"jpg":mediaType==="image/webp"?"webp":"png";
export async function uploadProjectSourceAsset(input:{projectId:string;role:ProjectSourceAssetRole;file:File;operationId?:string;supersedesAssetId?:string;signal?:AbortSignal;onProgress?:(state:"preparing"|"uploading"|"validating")=>void}){
  if(!MEDIA.has(input.file.type)||input.file.size<=0||input.file.size>MAX_BYTES)throw new Error("Use JPEG, PNG or WebP up to 20 MB.");
  input.onProgress?.("preparing");
  const checksum=await sha256(input.file),descriptor:SourceAssetUploadDescriptor={projectId:input.projectId,role:input.role,operationId:input.operationId??`source:${input.role}:${checksum}`,originalFilename:input.file.name,mediaType:input.file.type,byteSize:input.file.size,checksum};
  const health=await parseApiResponse<{kind:string}>(await fetch("/api/health/source-asset-store",{signal:input.signal})),pathname=`projects/${input.projectId}/source-assets/${checksum}.${extension(input.file.type)}`;
  input.onProgress?.("uploading");
  if(health.kind==="memory")await parseApiResponse(await fetch(`/api/projects/${encodeURIComponent(input.projectId)}/source-assets/direct`,{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Source-Role":input.role,"X-Source-Media-Type":input.file.type,"X-Source-Checksum":checksum},body:input.file,signal:input.signal}));
  else await upload(pathname,input.file,{access:"private",handleUploadUrl:`/api/projects/${encodeURIComponent(input.projectId)}/source-assets/upload`,clientPayload:JSON.stringify(descriptor),contentType:input.file.type,multipart:input.file.size>5*1024*1024,abortSignal:input.signal});
  input.onProgress?.("validating");
  const result=await parseApiResponse<{asset:ProjectSourceAssetSummary}>(await fetch(`/api/projects/${encodeURIComponent(input.projectId)}/source-assets/finalize`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...descriptor,supersedesAssetId:input.supersedesAssetId}),signal:input.signal}));
  return result.asset;
}
export const listProjectSourceAssets=async(projectId:string,signal?:AbortSignal)=>parseApiResponse<{assets:ProjectSourceAssetSummary[]}>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/source-assets`,{signal}));
export const getProjectSourceAssetReadHandle=async(projectId:string,assetId:string,signal?:AbortSignal)=>parseApiResponse<{url:string;expiresAt:string;mediaType:string}>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/source-assets/${encodeURIComponent(assetId)}/read-handle`,{method:"POST",signal}));
