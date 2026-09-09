import {get,head,issueSignedToken,presignUrl,put} from "@vercel/blob";
import {createHash} from "node:crypto";
import type {ProductionArtifactStore} from "../../domain/export-engine/index.js";
import {assertSafeArchivePath,sanitizeFilenamePart} from "../../domain/export-engine/index.js";
import {probePrivateBlobAuthentication,type BlobTokenIssuer} from "../blob-health.js";
export const EXPORT_ARTIFACT_HEALTH_PROBE="health/picadesigner-export-probe";
const parse=(ref:string,projectId:string)=>{const prefix=`export-blob://${sanitizeFilenamePart(projectId)}/`;if(!ref.startsWith(prefix))throw new Error("Cross-project export access denied.");return ref.slice("export-blob://".length)};
export class VercelBlobProductionArtifactStore implements ProductionArtifactStore{
  readonly kind="durable" as const;
  constructor(private readonly healthOptions:{env?:NodeJS.ProcessEnv;issueToken?:BlobTokenIssuer}={}){}
  async put(input:Parameters<ProductionArtifactStore["put"]>[0]){assertSafeArchivePath(input.filename);if(createHash("sha256").update(input.bytes).digest("hex")!==input.checksum)throw new Error("Export checksum mismatch.");const pathname=`projects/${sanitizeFilenamePart(input.projectId)}/exports/${input.exportFingerprint}/${input.filename}`;try{await head(pathname);return`export-blob://${pathname}`}catch{await put(pathname,Buffer.from(input.bytes),{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:input.mediaType,cacheControlMaxAge:31536000});return`export-blob://${pathname}`}}
  async get(ref:string,projectId:string){const result=await get(parse(ref,projectId),{access:"private"});return result?.statusCode===200?new Uint8Array(await new Response(result.stream).arrayBuffer()):undefined}
  async exists(ref:string,projectId:string){try{await head(parse(ref,projectId));return true}catch{return false}}
  async createReadHandle(ref:string,projectId:string,mediaType:string,filename:string,ttlSeconds:number){const pathname=parse(ref,projectId),validUntil=Date.now()+ttlSeconds*1000,token=await issueSignedToken({pathname,operations:["get"],validUntil}),signed=await presignUrl(token,{access:"private",operation:"get",pathname,validUntil});return{url:signed.presignedUrl,expiresAt:new Date(validUntil).toISOString(),mediaType,filename}}
  async health(){const ok=await probePrivateBlobAuthentication(EXPORT_ARTIFACT_HEALTH_PROBE,this.healthOptions);return{status:ok?"ok" as const:"degraded" as const,store:"durable" as const,private:true,signedReads:true}}
}
