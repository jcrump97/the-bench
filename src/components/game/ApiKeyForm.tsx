import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

interface ApiKeyFormProps {
    onSave: (key: string) => void;
    onDemo: () => void;
}

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onSave, onDemo }) => {
    const [keyInput, setKeyInput] = useState('');

    const handleSetKey = () => {
        if (keyInput.trim().length > 0) {
            onSave(keyInput.trim());
        }
    };

    return (
        <Card className="w-[380px]">
            <CardHeader>
                <CardTitle>The Bench</CardTitle>
                <CardDescription>
                    AI-powered judicial simulation. Take the bench. Rule on cases. Build your reputation.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                        A Gemini API key is required to generate cases. Get one free at{' '}
                        <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                            aistudio.google.com
                        </a>
                    </p>
                    <Input
                        type="password"
                        placeholder="Gemini API Key"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                    />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
                <Button onClick={handleSetKey} disabled={!keyInput.trim()} className="w-full">
                    Enter Chamber
                </Button>
                <Button variant="outline" onClick={onDemo} className="w-full">
                    Play Demo — No API Key Needed
                </Button>
            </CardFooter>
        </Card>
    );
};
