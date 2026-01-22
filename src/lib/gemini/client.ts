import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = (apiKey: string) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });
};
