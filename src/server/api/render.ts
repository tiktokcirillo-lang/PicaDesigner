import {Router} from 'express';
import {createRenderSession} from '../../application/render-engine/index.js';
import type {CreateRenderSessionRequest} from '../../domain/render-engine/index.js';
export const createRenderRouter=()=>{const router=Router();router.post('/session',(req,res)=>{try{return res.json(createRenderSession(req.body as CreateRenderSessionRequest))}catch(e){return res.status(422).json({error:e instanceof Error?e.message:'Render planning failed.'})}});return router};
