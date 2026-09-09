import {issueSignedToken} from "@vercel/blob";

export type BlobTokenIssuer=(input:{pathname:string;operations:["head"];validUntil:number})=>Promise<unknown>;

export const hasBlobCredentials=(env:NodeJS.ProcessEnv=process.env):boolean=>Boolean(env.BLOB_READ_WRITE_TOKEN||(env.VERCEL_OIDC_TOKEN&&env.BLOB_STORE_ID));

export async function probePrivateBlobAuthentication(pathname:string,options:{env?:NodeJS.ProcessEnv;issueToken?:BlobTokenIssuer;now?:()=>number}={}):Promise<boolean>{
  if(!hasBlobCredentials(options.env))return false;
  if(pathname.includes("*"))return false;
  try{
    await (options.issueToken??issueSignedToken)({pathname,operations:["head"],validUntil:(options.now??Date.now)()+60_000});
    return true;
  }catch{return false}
}
