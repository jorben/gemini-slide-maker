import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { PresentationConfig } from '@/lib/types';
import { SlideStyle } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 创建 GoogleGenAI 实例
 * 
 * 注意：Google Gemini API 会根据请求的源 IP 地址判断用户位置。
 * 即使部署在 Cloudflare 美国节点，如果 Cloudflare 的出口 IP 被识别为不支持的区域，
 * 仍然会收到 "User location is not supported" 错误。
 * 
 * 解决方案：
 * 1. 使用 httpOptions.headers 确保不传递任何客户端相关的 headers
 * 2. 如果问题持续，考虑使用 Vertex AI（设置 vertexai: true）
 */
function getGenAI(request: NextRequest): GoogleGenAI {
  // Priority: 1. Request header, 2. Environment variable
  const headerKey = request.headers.get('x-api-key');
  const apiKey = headerKey || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('API key not configured. Please add GEMINI_API_KEY to .env.local');
  }
  
  // 检查是否使用 Vertex AI（无区域限制）
  const useVertexAI = process.env.USE_VERTEX_AI === 'true';
  
  if (useVertexAI) {
    // Vertex AI 模式 - 需要配置 GOOGLE_CLOUD_PROJECT 和 GOOGLE_CLOUD_LOCATION
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      httpOptions: {
        headers: {},
      },
    });
  }
  
  // Gemini API 模式 - 使用 httpOptions 确保纯服务端请求
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      // 显式设置空的 headers，确保不传递任何客户端相关的 headers
      // 如 X-Forwarded-For, CF-Connecting-IP, X-Real-IP 等
      headers: {},
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const genAI = getGenAI(request);
    const body = await request.json();
    const { action, payload } = body;

    if (!action || !payload) {
      return NextResponse.json(
        { success: false, error: 'Missing action or payload' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'plan-presentation':
        return await handlePlanPresentation(genAI, payload);
      
      case 'generate-image':
        return await handleGenerateImage(genAI, payload);
      
      case 'optimize-content':
        return await handleOptimizeContent(genAI, payload);
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

interface PlanPayload {
  document?: string;
  prompt?: string;
  model?: string;
}

async function handlePlanPresentation(genAI: GoogleGenAI, payload: PlanPayload) {
  const { document, prompt, model = 'gemini-2.5-flash' } = payload;

  if (!document && !prompt) {
    return NextResponse.json(
      { success: false, error: 'Missing document or prompt' },
      { status: 400 }
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Missing prompt' },
      { status: 400 }
    );
  }

  const config: PresentationConfig = JSON.parse(prompt);

  const stylePrompt =
    config.style === SlideStyle.CUSTOM
      ? `Custom Style: ${config.customStyleDescription}`
      : `Style: ${
          config.style === SlideStyle.MINIMAL
            ? 'Minimalist, high impact, few words'
            : 'Detailed, educational, comprehensive'
        }`;

  const additionalContext = config.additionalPrompt
    ? `\nImportant Additional Instructions from User: ${config.additionalPrompt}`
    : '';

  const systemInstruction = `
    You are an expert presentation designer. 
    Analyze the provided input (text or document) and split it into a ${config.pageCount}-page presentation.
    Output Language: ${config.language}.
    ${stylePrompt}
    ${additionalContext}

    Return a JSON object with a 'title' for the whole deck and an array of 'slides'.
    For each slide, provide:
    1. 'title': The slide headline.
    2. 'bulletPoints': 3-5 key points (text only).
    3. 'visualDescription': A highly detailed, artistic description of how the slide should look visually.
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      slides: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualDescription: { type: Type.STRING },
          },
          required: ['title', 'bulletPoints', 'visualDescription'],
        },
      },
    },
    required: ['title', 'slides'],
  };

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: {
        role: 'user',
        parts: [{ text: `Input Text:\n${(document || '').substring(0, 30000)}` }],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    if (!response.text) throw new Error('No response from AI');

    return NextResponse.json({
      success: true,
      data: { content: response.text },
    });
  } catch (error) {
    throw error;
  }
}

interface ImagePayload {
  prompt?: string;
  model?: string;
}

async function handleGenerateImage(genAI: GoogleGenAI, payload: ImagePayload) {
  const { prompt, model = 'gemini-2.5-flash-image' } = payload;

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Missing prompt' },
      { status: 400 }
    );
  }

  const data = JSON.parse(prompt);
  const { slide, deckTitle, config } = data;

  const styleContext =
    config.style === SlideStyle.CUSTOM
      ? config.customStyleDescription
      : config.style === SlideStyle.MINIMAL
      ? 'Modern, clean, lots of whitespace, corporate memphis or swiss style'
      : 'Professional, structured, grid layout, academic or technical style';

  const additionalContext = config.additionalPrompt
    ? `\nAdditional Style Requirements: ${config.additionalPrompt}`
    : '';

  const fullPrompt = `
    Design a professional presentation slide.
    
    Context:
    Presentation Title: ${deckTitle}
    Slide Title: ${slide.title}
    Style Guide: ${styleContext}
    ${additionalContext}
    
    Visual Instructions:
    ${slide.visualDescription}
    
    Important:
    - Create a high-quality slide design.
    - Ensure the layout has clear space for text overlay.
    - Aspect Ratio 16:9.
  `;

  const imageConfig: Record<string, string> = {
    aspectRatio: '16:9',
  };

  if (model.includes('pro')) {
    imageConfig.imageSize = '2K';
  }

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        imageConfig,
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return NextResponse.json({
          success: true,
          data: { content: `data:image/png;base64,${part.inlineData.data}` },
        });
      }
    }

    throw new Error('No image generated');
  } catch (error) {
    throw error;
  }
}

interface OptimizePayload {
  prompt?: string;
  model?: string;
}

async function handleOptimizeContent(genAI: GoogleGenAI, payload: OptimizePayload) {
  const { prompt, model = 'gemini-2.5-flash' } = payload;

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Missing prompt' },
      { status: 400 }
    );
  }

  const fullPrompt = `优化以下演示文稿内容，使其更加清晰、专业和吸引人：\n\n${prompt}`;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: {
        parts: [{ text: fullPrompt }],
      },
    });

    return NextResponse.json({
      success: true,
      data: { content: response.text || '' },
    });
  } catch (error) {
    throw error;
  }
}

