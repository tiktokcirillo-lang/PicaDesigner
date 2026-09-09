import {createHash} from "node:crypto";
import {del,get,head,issueSignedToken,presignUrl,put} from "@vercel/blob";
import {createProjectSourceAssetRef,parseProjectSourceAssetRef,sourceExtension,type ProjectSourceAssetStore} from "../../domain/source-assets/index.js";
import {probePrivateBlobAuthentication,type BlobTokenIssuer} from "../blob-health.js";
export const SOURCE_ASSET_HEALTH_PROBE="health/picadesigner-source-assets-probe";
export class VercelBlobProjectSourceAssetStore implements ProjectSourceAssetStore{
  readonly kind="durable" as const;readonly capabilities={durable:true,private:true as const,signedReads:true,directClientUpload:true};
  constructor(private readonly healthOptions:{env?:NodeJS.ProcessEnv;issueToken?:BlobTokenIssuer}={}){}
  async put(input:{projectId:string;bytes:Uint8Array;mediaType:string;checksum:string}){if(createHash("sha256").update(input.bytes).digest("hex")!==input.checksum)throw new Error("Source checksum mismatch.");const ext=sourceExtension(input.mediaType);if(!ext)throw new Error("Unsupported media type.");const ref=createProjectSourceAssetRef(input.projectId,input.checksum,ext),{pathname}=parseProjectSourceAssetRef(ref,input.projectId);try{await head(pathname);return ref}catch{await put(pathname,Buffer.from(input.bytes),{access:"private",addRandomSuffix:false,allowOverwrite:false,contentType:input.mediaType,cacheControlMaxAge:31536000});return ref}}
  async get(ref:string,projectId:string){const parsed=parseProjectSourceAssetRef(ref,projectId),result=await get(parsed.pathname,{access:"private"});if(!result||result.statusCode!==200)return undefined;const bytes=new Uint8Array(await new Response(result.stream).arrayBuffer());if(createHash("sha256").update(bytes).digest("hex")!==parsed.checksum)throw new Error("Source backing checksum mismatch.");return bytes}
  async exists(ref:string,projectId:string){try{await head(parseProjectSourceAssetRef(ref,projectId).pathname);return true}catch{return false}}
  async delete(ref:string,projectId:string){await del(parseProjectSourceAssetRef(ref,projectId).pathname)}
  async createReadHandle(ref:string,projectId:string,mediaType:string,ttlSeconds:number){const{pathname}=parseProjectSourceAssetRef(ref,projectId),validUntil=Date.now()+ttlSeconds*1000,token=await issueSignedToken({pathname,operations:["get"],validUntil}),result=await presignUrl(token,{access:"private",operation:"get",pathname,validUntil});return{url:result.presignedUrl,expiresAt:new Date(validUntil).toISOString(),mediaType}}
  async health(){const ok=await probePrivateBlobAuthentication(SOURCE_ASSET_HEALTH_PROBE,this.healthOptions);return{status:ok?"ok" as const:"degraded" as const,kind:"durable" as const,private:true as const}}
}
