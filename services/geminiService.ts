
import { GoogleGenAI, Modality } from "@google/genai";

// Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MimeTypeRegex = /^data:image\/(png|jpeg|webp);base64,/;

export async function removeBackground(base64Image: string): Promise<string> {
  const match = base64Image.match(MimeTypeRegex);
  if (!match || !match[1]) {
    throw new Error("Invalid image format. Only PNG, JPEG, and WEBP are supported.");
  }

  const mimeType = `image/${match[1]}`;
  const base64Data = base64Image.replace(MimeTypeRegex, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: 'Remove the background of this image. The new background must be transparent. The output image must have the exact same dimensions as the input image.',
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    // Fix: Iterate through parts to find the image data for more robust response handling.
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return part.inlineData.data;
        }
      }
    }
    
    const textResponse = response.text;
    throw new Error(`API did not return an image.${textResponse ? ` Response: ${textResponse}` : ''}`);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`The API returned an error: ${error.message}`);
    }
    throw new Error(`An unknown API error occurred.`);
  }
}
