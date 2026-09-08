import {createHash} from 'node:crypto';import {createGeneratedAssetRef,parseGeneratedAssetRef,type GeneratedAssetStore} from '../../domain/image-assets/index.js';
const extension=(media:string)=>media==='image/jpeg'?'jpg':media==='image/webp'?'webp':'png';
export class InMemoryGeneratedAssetStore implements GeneratedAssetStore{
  readonly kind:'memory'|'durable'='memory';readonly capabilities:GeneratedAssetStore['capabilities']={durable:false,private:true,signedReads:false,atomicObjectNames:true};
  constructor(protected data=new Map<string,Uint8Array>()){}
  async put(i:{projectId:string;assetId:string;bytes:Uint8Array;mediaType:string;checksum:string}){if(createHash('sha256').update(i.bytes).digest('hex')!==i.checksum)throw new Error('Generated asset checksum mismatch.');const ref=createGeneratedAssetRef('memory',i.projectId,i.checksum,extension(i.mediaType));this.data.set(ref,i.bytes.slice());return ref}
  async get(ref:string,projectId:string){const parsed=parseGeneratedAssetRef(ref,projectId),bytes=this.data.get(ref)?.slice();if(bytes&&createHash('sha256').update(bytes).digest('hex')!==parsed.checksum)throw new Error('Backing asset checksum mismatch.');return bytes}
  async exists(ref:string,projectId:string){parseGeneratedAssetRef(ref,projectId);return this.data.has(ref)}
  async delete(ref:string,projectId:string){parseGeneratedAssetRef(ref,projectId);this.data.delete(ref)}
  async health():ReturnType<GeneratedAssetStore['health']>{return{status:'ok',store:'memory',private:true,signedReads:false}}
}
export class MockDurableGeneratedAssetStore extends InMemoryGeneratedAssetStore{
  readonly kind='durable' as const;readonly capabilities={durable:true,private:true,signedReads:true,atomicObjectNames:true};
  constructor(backend=new Map<string,Uint8Array>(),private now=()=>Date.now()){super(backend)}
  async put(i:{projectId:string;assetId:string;bytes:Uint8Array;mediaType:string;checksum:string}){if(createHash('sha256').update(i.bytes).digest('hex')!==i.checksum)throw new Error('Generated asset checksum mismatch.');const ref=createGeneratedAssetRef('blob-private',i.projectId,i.checksum,extension(i.mediaType));this.data.set(ref,i.bytes.slice());return ref}
  async createReadHandle(ref:string,projectId:string,mediaType:string,ttl:number){parseGeneratedAssetRef(ref,projectId);if(!this.data.has(ref))throw new Error('Backing asset is missing.');return{url:`https://private.invalid/read/${encodeURIComponent(projectId)}?asset=${encodeURIComponent(ref)}&exp=${this.now()+ttl*1000}`,expiresAt:new Date(this.now()+ttl*1000).toISOString(),mediaType}}
  async health(){return{status:'ok' as const,store:'durable' as const,private:true,signedReads:true}}
}
export class UnavailableGeneratedAssetStore implements GeneratedAssetStore{readonly kind='unavailable' as const;readonly capabilities={durable:false,private:false,signedReads:false,atomicObjectNames:false};private fail():never{throw new Error('Generated asset storage is temporarily unavailable.')}async put():Promise<string>{return this.fail()}async get():Promise<undefined>{return this.fail()}async exists():Promise<boolean>{return this.fail()}async delete():Promise<void>{return this.fail()}async health(){return{status:'degraded' as const,store:'unavailable' as const,private:false,signedReads:false}}}
