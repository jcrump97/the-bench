import { useState } from 'react';
import { useGameStore } from './store/game-store';
import { generateNewCase } from './lib/gemini/service';
import { getRandomDemoCase } from './data/demo-cases';
import { Button } from './components/ui/button';
import { ApiKeyForm } from './components/game/ApiKeyForm';
import { ArraignmentView } from './components/game/ArraignmentView';
import { JudicialLayout } from './components/game/JudicialLayout';
import { ReputationBar } from './components/game/ReputationBar';
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import './App.css';

function App() {
  const { apiKey, currentCase, isDemoMode, setApiKey, setCurrentCase, setDemoMode } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleStartGame = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newCase = isDemoMode
        ? getRandomDemoCase()
        : await generateNewCase(apiKey!);
      setCurrentCase(newCase);
    } catch (err) {
      console.error(err);
      setError("Failed to generate case. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDemo = () => {
    setDemoMode(true);
    setApiKey('demo');
    setError(null);
    const demoCase = getRandomDemoCase();
    setCurrentCase(demoCase);
    toast({
      title: "Demo Mode",
      description: "Playing with a pre-generated case. No API calls required.",
    });
  };

  // Mode 1: Full Screen Dashboard (Trial)
  if (currentCase && currentCase.game_state.current_stage !== "Arraignment") {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <JudicialLayout />
        <Toaster />
      </div>
    );
  }

  // Mode 2: Centered Card Views (Setup & Arraignment)
  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col items-center justify-center p-4">
      {!apiKey && <ApiKeyForm onSave={(key) => { setApiKey(key); setDemoMode(false); }} onDemo={handleStartDemo} />}

      {apiKey && !currentCase && (
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">The Bench</h1>
          <ReputationBar />
          <p className="text-muted-foreground text-center max-w-md">
            Honorable Judge, the court is waiting. <br />
            Your reputation is at stake.
          </p>
          {isDemoMode && (
            <div className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full">
              Demo Mode
            </div>
          )}
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

      {currentCase && currentCase.game_state.current_stage === "Arraignment" && (
        <ArraignmentView caseData={currentCase} />
      )}
      <Toaster />
    </div>
  );
}

export default App;
