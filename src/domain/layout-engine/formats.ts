import type {CanvasSpec,FormatDefinition,Insets,NormalizedRect,Orientation,PixelRect,SafeAreaPolicy} from './types.js';

const inset=(v:number):Insets=>({top:v,right:v,bottom:v,left:v});
export const FORMAT_REGISTRY:Record<string,FormatDefinition>={
  square_1080:{id:'square_1080',width:1080,height:1080,aspectRatio:1,orientation:'square',category:'social_square',baseSafeArea:inset(.06),recommendedGrid:{kind:'modular',columnRange:[4,8],rowRange:[6,12]}},
  portrait_4_5:{id:'portrait_4_5',width:1080,height:1350,aspectRatio:.8,orientation:'portrait',category:'social_portrait',baseSafeArea:inset(.055),recommendedGrid:{kind:'hybrid',columnRange:[4,8],rowRange:[8,14]}},
  story_9_16:{id:'story_9_16',width:1080,height:1920,aspectRatio:.5625,orientation:'portrait',category:'social_story',baseSafeArea:{top:.08,right:.055,bottom:.12,left:.055},platformInsets:[{id:'story_chrome',insets:{top:.04,right:0,bottom:.06,left:0},configurable:true}],recommendedGrid:{kind:'hybrid',columnRange:[4,6],rowRange:[10,16]}},
  landscape_16_9:{id:'landscape_16_9',width:1920,height:1080,aspectRatio:16/9,orientation:'landscape',category:'presentation',baseSafeArea:{top:.06,right:.07,bottom:.06,left:.07},recommendedGrid:{kind:'column',columnRange:[8,12],rowRange:[6,10]}},
};
const aliases:Record<string,string>={'1:1':'square_1080','square':'square_1080','1080x1080':'square_1080','feed quadrado':'square_1080','4:5':'portrait_4_5','portrait':'portrait_4_5','1080x1350':'portrait_4_5','feed retrato':'portrait_4_5','9:16':'story_9_16','1080x1920':'story_9_16','story':'story_9_16','stories':'story_9_16','16:9':'landscape_16_9','1920x1080':'landscape_16_9','presentation':'landscape_16_9'};
const orientation=(w:number,h:number):Orientation=>w===h?'square':w>h?'landscape':'portrait';
export const resolveFormatDefinition=(value:string|{width:number;height:number;id?:string;category?:FormatDefinition['category']}):FormatDefinition=>{
  if(typeof value==='object'){
    if(!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<64||value.height<64||value.width>16384||value.height>16384)throw new Error('Invalid custom format dimensions.');
    return{id:value.id??`custom_${value.width}x${value.height}`,width:value.width,height:value.height,aspectRatio:value.width/value.height,orientation:orientation(value.width,value.height),category:value.category??'custom',baseSafeArea:inset(.06),recommendedGrid:{kind:'hybrid',columnRange:[4,12],rowRange:[6,16]}};
  }
  const normalized=value.trim().toLowerCase().replace(/\s+/g,' ');const dimensionalId=normalized.includes('1920x1080')?'landscape_16_9':normalized.includes('1080x1920')?'story_9_16':normalized.includes('1080x1350')?'portrait_4_5':normalized.includes('1080x1080')?'square_1080':undefined;const id=aliases[normalized]??dimensionalId??(FORMAT_REGISTRY[normalized]?normalized:undefined);
  if(!id)throw new Error(`Unknown format: ${value}`);return structuredClone(FORMAT_REGISTRY[id]);
};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export const resolveCanvas=(format:FormatDefinition,policy?:Partial<SafeAreaPolicy>):CanvasSpec=>{
  const safe={top:Math.max(format.baseSafeArea.top,policy?.minimum?.top??0),right:Math.max(format.baseSafeArea.right,policy?.minimum?.right??0),bottom:Math.max(format.baseSafeArea.bottom,policy?.minimum?.bottom??0),left:Math.max(format.baseSafeArea.left,policy?.minimum?.left??0)};
  const max=policy?.maximum; if(max){safe.top=Math.min(safe.top,max.top);safe.right=Math.min(safe.right,max.right);safe.bottom=Math.min(safe.bottom,max.bottom);safe.left=Math.min(safe.left,max.left);}
  for(const platform of policy?.platformInsets??[]){safe.top+=platform.insets.top;safe.right+=platform.insets.right;safe.bottom+=platform.insets.bottom;safe.left+=platform.insets.left;}
  return{width:format.width,height:format.height,aspectRatio:format.aspectRatio,orientation:format.orientation,safeArea:safe,contentArea:{x:clamp(safe.left),y:clamp(safe.top),width:clamp(1-safe.left-safe.right),height:clamp(1-safe.top-safe.bottom)}};
};
export const normalizedToPixel=(rect:NormalizedRect,canvas:Pick<CanvasSpec,'width'|'height'>):PixelRect=>{const x=Math.round(rect.x*canvas.width),y=Math.round(rect.y*canvas.height);return{x,y,width:Math.max(0,Math.min(canvas.width-x,Math.round(rect.width*canvas.width))),height:Math.max(0,Math.min(canvas.height-y,Math.round(rect.height*canvas.height)))}};
export const pixelToNormalized=(rect:PixelRect,canvas:Pick<CanvasSpec,'width'|'height'>):NormalizedRect=>({x:rect.x/canvas.width,y:rect.y/canvas.height,width:rect.width/canvas.width,height:rect.height/canvas.height});
