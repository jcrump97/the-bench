import { useState } from 'react';
import { useGameStore } from './store/game-store';
import { generateNewCase } from './lib/gemini/service';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/ui/card';
import { ArraignmentView } from './components/game/ArraignmentView';
import { JudicialLayout } from './components/game/JudicialLayout';
import { Toaster } from "./components/ui/toaster";
import './App.css';

function App() {
  const { apiKey, currentCase, setApiKey, setCurrentCase } = useGameStore();
  const [keyInput, setKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetKey = () => {
    if (keyInput.trim().length > 0) {
      setApiKey(keyInput.trim());
    }
  };

  const handleStartGame = async () => {
    if (!apiKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const newCase = await generateNewCase(apiKey);
      setCurrentCase(newCase);
    } catch (err) {
      console.error(err);
      setError("Failed to generate case. Please check your API key and try again.");
      // Optional: Allow resetting key if it fails consistently
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
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
      </div>
    );
  }

  return (
    <>
      {currentCase ? (
        <div className="min-h-screen bg-background text-foreground">
          <header className="p-4 border-b flex justify-between items-center">
            <h1 className="text-xl font-bold">The Bench</h1>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Resign Session</Button>
          </header>
          <main>
            {currentCase.game_state.current_stage === 'Arraignment' ? (
              <ArraignmentView caseData={currentCase} />
            ) : (
              <JudicialLayout caseData={currentCase} />
            )}
          </main>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">The Bench</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Honorable Judge, the court is waiting. <br />
            Your reputation is at stake.
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
              {error}
            </div>
          )}

          <Button size="lg" onClick={handleStartGame} disabled={isLoading}>
            {isLoading ? "Generating Docket..." : "Call to Order"}
          </Button>
        </div>
      )}
      <Toaster />
    </>
  );
}

export default App;
