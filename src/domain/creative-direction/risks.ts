import type {ArtDirectionRoute} from './types.js';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const calculateRouteBrandDriftRisk=(route:ArtDirectionRoute)=>clamp((route.declaredBrandDriftTraits?.length??0)/5+(route.declaredHardViolations?.length??0)*0.5);
export const calculateRouteReferenceImitationRisk=(route:ArtDirectionRoute)=>clamp((route.literalReferenceTraits?.length??0)/5);
