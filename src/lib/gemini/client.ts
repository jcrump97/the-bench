import { GoogleGenerativeAI } from '@google/generative-ai';

export const getGeminiModel = (apiKey: string) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
            responseMimeType: 'application/json'
        }
    });
};
