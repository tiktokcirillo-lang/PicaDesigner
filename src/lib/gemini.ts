import { GoogleGenAI, Modality } from "@google/genai";

export interface GeneratedDesign {
  imageData: string;
  mimeType: string;
}

export interface DesignRequest {
  type: string;
  description: string;
  style: string;
  colors: string;
  format?: string;
}

function buildPrompt(req: DesignRequest): string {
  return `Create a professional ${req.type} design with the following specifications:
- Description: ${req.description}
- Visual style: ${req.style}
- Color palette: ${req.colors}
- Format: ${req.format ?? req.type}

Requirements:
- High quality, professional result ready for commercial use
- Clean composition with excellent visual hierarchy
- Suitable for a business/brand context
- No watermarks or text artifacts

Generate a single, high-quality image.`;
}

export async function generateDesign(
  apiKey: string,
  req: DesignRequest
): Promise<GeneratedDesign> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-preview-image-generation",
    contents: buildPrompt(req),
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData?.mimeType) {
      return {
        imageData: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  throw new Error("Nenhuma imagem foi gerada. Verifique sua API key e tente novamente.");
}

export function validateApiKey(key: string): boolean {
  return key.trim().startsWith("AI") && key.trim().length > 20;
}
