import { useState } from 'react';
import { useGameStore } from './store/game-store';
import { generateNewCase } from './lib/gemini/service';
import { Button } from './components/ui/button';
import { ApiKeyForm } from './components/game/ApiKeyForm';
import { ArraignmentView } from './components/game/ArraignmentView';
import { JudicialLayout } from './components/game/JudicialLayout';
import { JudicialDock } from './components/game/JudicialDock';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./components/ui/sheet";
import { DefendantPanel } from './components/game/DefendantPanel';
import { CaseFilePanel } from './components/game/CaseFilePanel';
import { MotionTray } from './components/game/MotionTray';
import { Toaster } from "./components/ui/toaster";
import './App.css';

function App() {
  const { apiKey, currentCase, setApiKey, setCurrentCase, activeSheet, setActiveSheet, isMotionsOpen, setIsMotionsOpen } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setIsLoading(false);
    }
  };
  // Helper to render shared panels across all views
  const renderSharedPanels = () => (
    <>
      <JudicialDock
        onOpenDefendant={() => setActiveSheet(activeSheet === 'defendant' ? null : 'defendant')}
        onOpenEvidence={() => setActiveSheet(activeSheet === 'evidence' ? null : 'evidence')}
        onOpenMotions={() => setIsMotionsOpen(!isMotionsOpen)}
        onIssueRuling={() => { }}
      />

      <Sheet open={activeSheet === 'defendant'} onOpenChange={(open) => setActiveSheet(open ? 'defendant' : null)}>
        <SheetContent side="left" className="w-[400px] sm:w-[540px] overflow-y-auto z-[100]">
          <SheetHeader>
            <SheetTitle>Defendant Profile</SheetTitle>
            <SheetDescription>Background and history of the accused.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {currentCase && <DefendantPanel defendant={currentCase.defendant} />}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={activeSheet === 'evidence'} onOpenChange={(open) => setActiveSheet(open ? 'evidence' : null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto z-[100]">
          <SheetHeader>
            <SheetTitle>Case Evidence</SheetTitle>
            <SheetDescription>Exhibits, witness statements, and charges.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {currentCase && <CaseFilePanel caseData={currentCase} />}
          </div>
        </SheetContent>
      </Sheet>

      {isMotionsOpen && (
        <div className="fixed bottom-20 right-4 w-[350px] bg-card border shadow-lg rounded-lg z-[90]">
          <div className="p-2 bg-muted/20 border-b flex justify-between items-center rounded-t-lg">
            <span className="font-bold text-sm px-2">Available Motions</span>
            <button onClick={() => setIsMotionsOpen(false)} className="text-xs hover:text-destructive p-1">Close</button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <MotionTray />
          </div>
        </div>
      )}
    </>
  );

  // Mode 1: Full Screen Dashboard (Trial)
  if (currentCase && currentCase.game_state.current_stage !== "Arraignment") {
    return (
      <div className="h-screen w-full overflow-hidden bg-background text-foreground">
        <JudicialLayout />
        <Toaster />
      </div>
    );
  }

  // Mode 2: Centered Card Views (Setup & Arraignment)
  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col items-center justify-center p-4">
      {!apiKey && <ApiKeyForm onSave={setApiKey} />}

      {apiKey && !currentCase && (
        <div className="flex flex-col items-center space-y-4">
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
            {/* Call to Action button triggers case generation */}
            {isLoading ? "Generating Docket..." : "Call to Order"}
          </Button>
        </div>
      )}

      {currentCase && currentCase.game_state.current_stage === "Arraignment" && (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col relative">
          <header className="p-3 border-b flex justify-between items-center bg-card z-10 shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold">The Bench: Arraignment</h1>
              <div className="px-3 py-1 bg-muted rounded text-xs font-mono">
                Docket: {currentCase.case_metadata.docket_number}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 bg-muted/5 relative">
            <ArraignmentView caseData={currentCase} />
          </main>

          {renderSharedPanels()}
        </div>
      )}
      <Toaster />
    </div>
  );
}

export default App;
