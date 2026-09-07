import type {ArtDirectionRoute, CreativeDivergenceVector} from './types.js';
export const MIN_ROUTE_DISTANCE = 0.25;
const KEYS: Array<keyof CreativeDivergenceVector> = ['abstraction','humanFocus','productFocus','editoriality','dynamism','minimalism','dimensionality','narrativeDepth','typographicExpression'];
export const calculateCreativeRouteDistance = (a:ArtDirectionRoute,b:ArtDirectionRoute) => KEYS.reduce((sum,key)=>sum+Math.abs(a.divergenceVector[key]-b.divergenceVector[key]),0)/KEYS.length;
export const evaluateRouteDiversity = (routes:ArtDirectionRoute[]) => {const distances:number[]=[];for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++)distances.push(calculateCreativeRouteDistance(routes[i]!,routes[j]!));return {distances,minimum:distances.length?Math.min(...distances):0,sufficient:routes.length===3&&distances.every(value=>value>=MIN_ROUTE_DISTANCE)};};
