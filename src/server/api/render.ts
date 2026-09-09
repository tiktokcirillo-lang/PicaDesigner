import {Router} from "express";
import {createRenderSession} from "../../application/render-engine/index.js";
import {resolveProjectSourceRegistry} from "../../application/source-assets/index.js";
import type {CreateRenderSessionRequest,RenderSession} from "../../domain/render-engine/index.js";
import {applicationProjectSourceAssetRepository,applicationProjectSourceAssetStore} from "../../infrastructure/source-assets/index.js";
type SourceAwareRenderRequest=CreateRenderSessionRequest&{sourceAssetIds?:string[]};
const withoutPrivateSourceRefs=(session:RenderSession):RenderSession=>JSON.parse(JSON.stringify(session,(key,value)=>key==="backingRef"&&typeof value==="string"&&value.startsWith("source-private://")?undefined:value)) as RenderSession;
export const createRenderRouter=()=>{const router=Router();router.post("/session",async(req,res)=>{try{const body=req.body as SourceAwareRenderRequest,source=await resolveProjectSourceRegistry(body.projectId,body.sourceAssetIds??[],applicationProjectSourceAssetRepository,applicationProjectSourceAssetStore),session=createRenderSession({...body,assetRegistry:source.registry});return res.json(withoutPrivateSourceRefs(session))}catch(e){return res.status(422).json({error:e instanceof Error?e.message:"Render planning failed."})}});return router};
