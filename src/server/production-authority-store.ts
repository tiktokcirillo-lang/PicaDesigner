import type {VisualApprovedRenderPackage} from '../domain/post-render-review/index.js';
const packages=new Map<string,VisualApprovedRenderPackage>();const key=(projectId:string,postRenderReviewSessionId:string)=>`${projectId}:${postRenderReviewSessionId}`;
export const registerVisualApprovedPackage=(pkg:VisualApprovedRenderPackage)=>packages.set(key(pkg.projectId,pkg.postRenderReviewSessionId),structuredClone(pkg));
export const resolveVisualApprovedPackage=(projectId:string,postRenderReviewSessionId:string)=>{const pkg=packages.get(key(projectId,postRenderReviewSessionId));return pkg?structuredClone(pkg):undefined};
