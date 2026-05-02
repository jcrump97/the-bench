
import React from 'react';
import { useGameStore } from '../../store/game-store';
import { Badge } from "../ui/badge";
import { DefendantPanel } from './DefendantPanel';
import { CaseFilePanel } from './CaseFilePanel';
import { TranscriptArea } from './TranscriptArea';
import { MotionTray } from './MotionTray';
import { JudicialDock } from './JudicialDock';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "../ui/sheet";

export const JudicialLayout: React.FC = () => {
    const {
        currentCase,
        activeSheet,
        isMotionsOpen,
        setActiveSheet,
        setIsMotionsOpen
    } = useGameStore((state) => ({
        currentCase: state.currentCase,
        activeSheet: state.activeSheet,
        isMotionsOpen: state.isMotionsOpen,
        setActiveSheet: state.setActiveSheet,
        setIsMotionsOpen: state.setIsMotionsOpen
    }));

    if (!currentCase) {
        return <div className="flex items-center justify-center h-screen">Loading case data...</div>;
    }

    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col relative">
            <header className="p-3 border-b flex justify-between items-center bg-card z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">The Bench: Judicial Chamber</h1>
                    <Badge variant="outline">Case: {currentCase.case_metadata.docket_number}</Badge>
                    <Badge variant="secondary">{currentCase.game_state.current_stage}</Badge>
                </div>
            </header>

            {/* Main Content Area - Full Width Transcript */}
            <main className="flex-1 overflow-hidden relative bg-muted/5 flex flex-col">
                <div className="flex-1 w-full max-w-5xl mx-auto h-full p-4">
                    <TranscriptArea />
                </div>
            </main>

            {/* Judicial Dock - Fixed Bottom */}
            <JudicialDock
                onOpenDefendant={() => setActiveSheet('defendant')}
                onOpenEvidence={() => setActiveSheet('evidence')}
                onOpenMotions={() => setIsMotionsOpen(!isMotionsOpen)}
                onIssueRuling={() => { }} // Placeholder for now
            />

            {/* Defendant Profile Sheet */}
            <Sheet open={activeSheet === 'defendant'} onOpenChange={(open) => setActiveSheet(open ? 'defendant' : null)}>
                <SheetContent side="left" className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Defendant Profile</SheetTitle>
                        <SheetDescription>Background and history of the accused.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        <DefendantPanel defendant={currentCase.defendant} />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Evidence/Case File Sheet */}
            <Sheet open={activeSheet === 'evidence'} onOpenChange={(open) => setActiveSheet(open ? 'evidence' : null)}>
                <SheetContent side="right" className="w-[400px] sm:w-[540px] overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>Case Evidence</SheetTitle>
                        <SheetDescription>Exhibits, witness statements, and charges.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        <CaseFilePanel caseData={currentCase} />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Motions Overlay (Simple absolute positioning or Popover for now) */}
            {isMotionsOpen && (
                <div className="absolute bottom-20 right-4 w-[350px] bg-card border shadow-lg rounded-lg z-20">
                    <div className="p-2 bg-muted/20 border-b flex justify-between items-center rounded-t-lg">
                        <span className="font-bold text-sm px-2">Available Motions</span>
                        <button onClick={() => setIsMotionsOpen(false)} className="text-xs hover:text-destructive p-1">Close</button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        <MotionTray />
                    </div>
                </div>
            )}
        </div>
    );
};
