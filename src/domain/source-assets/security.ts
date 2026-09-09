import type {ProjectSourceAssetRole} from "./types.js";
const PROJECT=/^[A-Za-z0-9_-]{1,128}$/,CHECKSUM=/^[a-f0-9]{64}$/;
export const sourceExtension=(mediaType:string)=>mediaType==="image/jpeg"?"jpg":mediaType==="image/webp"?"webp":mediaType==="image/png"?"png":undefined;
export const createProjectSourceAssetRef=(projectId:string,checksum:string,extension:string)=>{if(!PROJECT.test(projectId)||!CHECKSUM.test(checksum)||!/^(png|jpg|webp)$/.test(extension))throw new Error("Invalid source asset identity.");return`source-private://${projectId}/${checksum}.${extension}`};
export const parseProjectSourceAssetRef=(ref:string,expectedProjectId?:string)=>{const match=/^source-private:\/\/([A-Za-z0-9_-]{1,128})\/([a-f0-9]{64})\.(png|jpg|webp)$/.exec(ref);if(!match||expectedProjectId&&match[1]!==expectedProjectId)throw new Error("Invalid or cross-project source asset reference.");return{projectId:match[1]!,checksum:match[2]!,extension:match[3]!,pathname:`projects/${match[1]}/source-assets/${match[2]}.${match[3]}`}};
export const allowedMediaTypesFor=(role:ProjectSourceAssetRole):string[]=>role==="graphic_asset"?["image/png","image/webp"]:["image/jpeg","image/png","image/webp"];
export const safeOriginalFilename=(value:string)=>value.replace(/[\u0000-\u001f/\\]/g,"-").slice(0,180)||"asset";
