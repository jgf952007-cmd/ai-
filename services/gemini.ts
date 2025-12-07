import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODELS = {
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-3-pro-preview", 
  IMAGE: "gemini-2.5-flash-image"
};

const getClient = (): GoogleGenAI => {
  let apiKey = "";
  try {
    // Check environment variable first
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    // Ignore process error
  }

  // Fallback to localStorage if available
  if (!apiKey && typeof window !== 'undefined' && window.localStorage) {
    apiKey = window.localStorage.getItem("gemini_api_key") || "";
  }

  if (!apiKey) {
    throw new Error("API Key 未配置。请点击右上角设置图标输入您的 Google Gemini API Key。");
  }

  return new GoogleGenAI({ apiKey });
};

const safeJsonParse = (text: string) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {
    try {
      // Try to clean markdown code blocks
      let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e2) {
      // Try to find the first '{' and last '}'
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
         try {
            return JSON.parse(text.substring(start, end + 1));
         } catch (e3) {
            // Last resort: try to find array brackets if object failed
            const startArr = text.indexOf('[');
            const endArr = text.lastIndexOf(']');
            if (startArr !== -1 && endArr !== -1) {
                return JSON.parse(text.substring(startArr, endArr + 1));
            }
         }
      }
    }
  }
  console.warn("JSON Parse Failed for text:", text);
  return null;
};

export const callGemini = async (prompt: string, systemInstruction: string, isJson: boolean = false, modelId: string = GEMINI_MODELS.FLASH): Promise<string> => {
  const performCall = async (model: string) => {
    const ai = getClient();
    const config: any = {
      temperature: 0.85,
    };

    if (isJson) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        ...config,
        systemInstruction: systemInstruction,
      },
    });

    const text = response.text;
    if (!text) throw new Error("API returned empty content");
    return text;
  };

  try {
    return await performCall(modelId);
  } catch (e: any) {
    console.warn(`Gemini API Error with model ${modelId}:`, e);
    
    // Fallback logic: If PRO fails, try FLASH
    if (modelId === GEMINI_MODELS.PRO) {
      console.info("Falling back to Flash model...");
      try {
        return await performCall(GEMINI_MODELS.FLASH);
      } catch (fallbackError: any) {
        throw new Error(`AI 服务暂时不可用: ${fallbackError.message || "未知错误"}`);
      }
    }

    throw new Error(`请求失败: ${e.message || "请检查 API Key 或网络连接"}`);
  }
};

export const callImageGen = async (prompt: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.IMAGE,
      contents: prompt,
      config: {
        responseMimeType: "image/png"
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data returned");
  } catch (e: any) {
    console.error("Image Gen Error:", e);
    // Fallback to a placeholder
    return `https://picsum.photos/seed/${encodeURIComponent(prompt).slice(0, 10)}/512/512`;
  }
};

export { safeJsonParse };