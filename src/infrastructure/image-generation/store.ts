import type {GeneratedAssetStore} from '../../domain/image-assets/index.js';
export class InMemoryGeneratedAssetStore implements GeneratedAssetStore{private data=new Map<string,Uint8Array>();async put(i:{projectId:string;assetId:string;bytes:Uint8Array}){const ref=`memory://${encodeURIComponent(i.projectId)}/${encodeURIComponent(i.assetId)}`;this.data.set(ref,i.bytes.slice());return ref}async get(ref:string){return this.data.get(ref)?.slice()}}
export const applicationGeneratedAssetStore=new InMemoryGeneratedAssetStore();
