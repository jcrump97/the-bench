import React from 'react';
import { useGameStore } from '../../store/game-store';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "../ui/resizable";
import { Badge } from "../ui/badge";
import { DefendantPanel } from './DefendantPanel';
import { CaseFilePanel } from './CaseFilePanel';
import { TranscriptArea } from './TranscriptArea';
import { MotionTray } from './MotionTray';

export const JudicialLayout: React.FC = () => {
    const currentCase = useGameStore((state) => state.currentCase);

    if (!currentCase) {
        return <div className="flex items-center justify-center h-screen">Loading case data...</div>;
    }

    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
            <header className="p-3 border-b flex justify-between items-center bg-card z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">The Bench: Judicial Chamber</h1>
                    <Badge variant="outline">Case: {currentCase.case_metadata.docket_number}</Badge>
                    <Badge variant="secondary">{currentCase.game_state.current_stage}</Badge>
                </div>
            </header>

            <ResizablePanelGroup orientation="horizontal" className="flex-1">
                {/* Left Panel: Defendant Profile (20%) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <DefendantPanel defendant={currentCase.defendant} />
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Center Panel: Transcript & Motions (60%) */}
                <ResizablePanel defaultSize={60}>
                    <ResizablePanelGroup orientation="vertical">
                        {/* Transcript Area (80%) */}
                        <ResizablePanel defaultSize={80}>
                            <TranscriptArea />
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        {/* Motion Tray (20%) */}
                        <ResizablePanel defaultSize={20} minSize={15}>
                            <MotionTray />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Case File (20%) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <CaseFilePanel caseData={currentCase} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};
