import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

interface ApiKeyFormProps {
    onSave: (key: string) => void;
}

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({ onSave }) => {
    const [keyInput, setKeyInput] = useState('');

    const handleSetKey = () => {
        if (keyInput.trim().length > 0) {
            onSave(keyInput.trim());
        }
    };

    return (
        <Card className="w-[350px]">
            <CardHeader>
                <CardTitle>The Bench</CardTitle>
                <CardDescription>Enter your Gemini API Key to begin.</CardDescription>
            </CardHeader>
            <CardContent>
                <Input
                    type="password"
                    placeholder="API Key"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                />
            </CardContent>
            <CardFooter>
                <Button onClick={handleSetKey} className="w-full">Enter Chamber</Button>
            </CardFooter>
        </Card>
    );
};
