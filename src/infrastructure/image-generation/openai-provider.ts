import type OpenAI from 'openai';
import type {ImageGenerateParamsNonStreaming} from 'openai/resources/images';
import {buildProviderPrompt,type ImageGenerationJob,type ImageGenerationProvider,type ImageGenerationResult} from '../../domain/image-assets/index.js';
import {ImageGenerationError,ImagePricingUnavailableError} from './errors.js';

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly id='openai';
  constructor(private client:OpenAI,private configuredEstimateUsd?:number) {}
  capabilities(){return {models:['gpt-image-2'],formats:['png' as const,'jpeg' as const,'webp' as const],qualities:['draft' as const,'standard' as const,'final' as const],transparentBackground:true,arbitrarySize:true,minEdge:16,maxEdge:3840,edgeMultiple:16,minAspectRatio:1/3,maxAspectRatio:3};}
  estimateCost(){
    if(!this.configuredEstimateUsd||this.configuredEstimateUsd<=0)throw new ImagePricingUnavailableError('Image pricing estimate is unavailable; configure AI_IMAGE_ESTIMATED_COST_USD before paid generation.');
    return this.configuredEstimateUsd;
  }
  async generate(j:ImageGenerationJob):Promise<ImageGenerationResult>{
    const started=Date.now();
    const quality=j.quality==='draft'?'low':j.quality==='final'?'high':'medium';
    try {
      const response=await this.client.images.generate({model:j.model,prompt:buildProviderPrompt(j.promptPlan),n:1,size:`${j.size.width}x${j.size.height}`,quality,output_format:j.outputFormat} as ImageGenerateParamsNonStreaming);
      const encoded=response.data?.[0]?.b64_json;
      if(!encoded)throw new ImageGenerationError('OpenAI image response did not contain image bytes.');
      const mediaType:ImageGenerationResult['mediaType']=j.outputFormat==='jpeg'?'image/jpeg':j.outputFormat==='webp'?'image/webp':'image/png';
      const usage=response.usage?{inputTokens:response.usage.input_tokens,outputTokens:response.usage.output_tokens}:undefined;
      return {bytes:Uint8Array.from(Buffer.from(encoded,'base64')),mediaType,width:j.size.width,height:j.size.height,model:j.model,requestId:String(response.created??Date.now()),durationMs:Date.now()-started,usage};
    } catch(e) {
      if(e instanceof ImageGenerationError)throw e;
      throw new ImageGenerationError(e instanceof Error?e.message:'OpenAI image generation failed.');
    }
  }
}
