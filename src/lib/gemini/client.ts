import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = (apiKey: string) => {
    const cleanKey = apiKey?.trim().replace(/^["']|["']$/g, '');

    const genAI = new GoogleGenerativeAI(cleanKey);
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });
};
