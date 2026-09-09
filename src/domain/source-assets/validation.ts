import {createHash} from "node:crypto";
import sharp from "sharp";
import {allowedMediaTypesFor} from "./security.js";
import type {ProjectSourceAssetRole} from "./types.js";
type SourceMediaType="image/jpeg"|"image/png"|"image/webp";
export const loadSourceAssetConfig=(env:NodeJS.ProcessEnv=process.env)=>({maxBytes:Math.round(Number(env.SOURCE_ASSET_MAX_MB??20)*1024*1024),maxPixels:Number(env.SOURCE_ASSET_MAX_PIXELS??40_000_000),ttlSeconds:Number(env.SOURCE_ASSET_SIGNED_URL_TTL_SECONDS??300)});
export async function validateProjectSourceImage(input:{bytes:Uint8Array;declaredMediaType:string;role:ProjectSourceAssetRole;expectedChecksum?:string;maxBytes:number;maxPixels:number}):Promise<{checksum:string;mediaType:SourceMediaType;width:number;height:number;aspectRatio:number;hasAlpha:boolean}>{
  if(input.bytes.byteLength<=0||input.bytes.byteLength>input.maxBytes)throw new Error("Source asset file size is invalid.");
  const metadata=await sharp(input.bytes,{limitInputPixels:input.maxPixels,failOn:"error"}).metadata();
  const actual:SourceMediaType|undefined=metadata.format==="jpeg"?"image/jpeg":metadata.format==="png"?"image/png":metadata.format==="webp"?"image/webp":undefined;
  if(!actual||!allowedMediaTypesFor(input.role).includes(actual))throw new Error("Unsupported source image content.");
  if(actual!==input.declaredMediaType)throw new Error("Declared media type does not match image bytes.");
  if(!metadata.width||!metadata.height||metadata.width<16||metadata.height<16||metadata.width*metadata.height>input.maxPixels)throw new Error("Source image dimensions are unsafe.");
  const checksum=createHash("sha256").update(input.bytes).digest("hex");
  if(input.expectedChecksum&&checksum!==input.expectedChecksum)throw new Error("Source asset checksum mismatch.");
  return{checksum,mediaType:actual,width:metadata.width,height:metadata.height,aspectRatio:metadata.width/metadata.height,hasAlpha:Boolean(metadata.hasAlpha)};
}
