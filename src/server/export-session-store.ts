import type {ProductionExportSession} from '../domain/export-engine/index.js';
const sessions=new Map<string,ProductionExportSession>();
export const saveExportSession=(session:ProductionExportSession)=>sessions.set(session.sessionId,structuredClone(session));
export const getExportSession=(sessionId:string)=>{const session=sessions.get(sessionId);return session?structuredClone(session):undefined};
