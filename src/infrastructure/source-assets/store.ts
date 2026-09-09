import {createHash} from "node:crypto";
import {createProjectSourceAssetRef,parseProjectSourceAssetRef,sourceExtension,type ProjectSourceAssetStore} from "../../domain/source-assets/index.js";
export interface MockSourceAssetBacking{objects:Record<string,Uint8Array>;available:boolean}
export const createMockSourceAssetBacking=():MockSourceAssetBacking=>({objects:{},available:true});
export class MemoryProjectSourceAssetStore implements ProjectSourceAssetStore{
  readonly kind:ProjectSourceAssetStore["kind"]="memory";
  readonly capabilities:ProjectSourceAssetStore["capabilities"]={durable:false,private:true,signedReads:false,directClientUpload:false};
  constructor(protected backing=createMockSourceAssetBacking()){}
  protected ready(){if(!this.backing.available)throw new Error("Source asset store unavailable.")}
  async put(input:{projectId:string;bytes:Uint8Array;mediaType:string;checksum:string}){this.ready();if(createHash("sha256").update(input.bytes).digest("hex")!==input.checksum)throw new Error("Source checksum mismatch.");const extension=sourceExtension(input.mediaType);if(!extension)throw new Error("Unsupported source media type.");const ref=createProjectSourceAssetRef(input.projectId,input.checksum,extension),{pathname}=parseProjectSourceAssetRef(ref,input.projectId);this.backing.objects[pathname]=structuredClone(input.bytes);return ref}
  async get(ref:string,projectId:string){this.ready();const parsed=parseProjectSourceAssetRef(ref,projectId),bytes=this.backing.objects[parsed.pathname];if(!bytes)return undefined;if(createHash("sha256").update(bytes).digest("hex")!==parsed.checksum)throw new Error("Source backing checksum mismatch.");return structuredClone(bytes)}
  async exists(ref:string,projectId:string){this.ready();return Boolean(this.backing.objects[parseProjectSourceAssetRef(ref,projectId).pathname])}
  async delete(ref:string,projectId:string){this.ready();delete this.backing.objects[parseProjectSourceAssetRef(ref,projectId).pathname]}
  async health(){return{status:this.backing.available?"ok" as const:"degraded" as const,kind:this.kind,private:true as const}}
}
export class MockDurableProjectSourceAssetStore extends MemoryProjectSourceAssetStore{
  override readonly kind:ProjectSourceAssetStore["kind"]="durable";
  override readonly capabilities:ProjectSourceAssetStore["capabilities"]={durable:true,private:true,signedReads:true,directClientUpload:true};
  async createReadHandle(ref:string,projectId:string,mediaType:string,ttlSeconds:number){parseProjectSourceAssetRef(ref,projectId);return{url:`/api/mock-source/${encodeURIComponent(projectId)}/${encodeURIComponent(ref)}`,expiresAt:new Date(Date.now()+ttlSeconds*1000).toISOString(),mediaType}}
  override async health(){return{status:this.backing.available?"ok" as const:"degraded" as const,kind:this.kind,private:true as const}}
}
export class UnavailableProjectSourceAssetStore implements ProjectSourceAssetStore{
  readonly kind="unavailable" as const;readonly capabilities={durable:false,private:true as const,signedReads:false,directClientUpload:false};private fail():never{throw new Error("Durable source asset storage unavailable.")}put(){return this.fail()}get(){return this.fail()}exists(){return this.fail()}delete(){return this.fail()}async health(){return{status:"degraded" as const,kind:"unavailable" as const,private:true as const}}
}
