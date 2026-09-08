import {zipSync,unzipSync} from 'fflate';import {assertSafeArchivePath} from '../../domain/export-engine/index.js';
const FIXED_DATE=new Date(1980,0,1,0,0,0,0);
export const buildProductionZip=(entries:Array<{path:string;bytes:Uint8Array}>)=>{const ordered=[...entries].sort((a,b)=>a.path.localeCompare(b.path)),files:Record<string,[Uint8Array,{mtime:Date}]>={};for(const entry of ordered)files[assertSafeArchivePath(entry.path)]=[entry.bytes,{mtime:FIXED_DATE}];return zipSync(files,{level:6})};
export const inspectProductionZip=(bytes:Uint8Array)=>Object.keys(unzipSync(bytes)).sort();
