import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "../ui/resizable";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DefendantPanel } from './DefendantPanel';
import { CaseFilePanel } from './CaseFilePanel';
import { TranscriptArea } from './TranscriptArea';
import { MotionTray } from './MotionTray';
import { ReputationBar } from './ReputationBar';
import { VerdictForm } from './VerdictForm';
import { SentencingForm } from './SentencingForm';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { useTheme } from '../../hooks/use-theme';
import { User, MessageSquare, Gavel, FileText, Sun, Moon } from 'lucide-react';

type MobileTab = 'defendant' | 'transcript' | 'motions' | 'casefile';

const MOBILE_TABS: { id: MobileTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'defendant', label: 'Defendant', icon: User },
    { id: 'transcript', label: 'Transcript', icon: MessageSquare },
    { id: 'motions', label: 'Motions', icon: Gavel },
    { id: 'casefile', label: 'Case File', icon: FileText },
];

function Header({ docket, stage }: { docket: string; stage: string }) {
    const { effectiveTheme, toggleTheme } = useTheme();
    return (
        <header className="p-2 md:p-3 border-b flex justify-between items-center bg-card z-10">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <h1 className="text-sm md:text-lg font-bold truncate">The Bench</h1>
                <Badge variant="outline" className="text-xs shrink-0">Case: {docket}</Badge>
                <Badge variant="secondary" className="text-xs shrink-0">{stage}</Badge>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} aria-label="Toggle theme">
                    {effectiveTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <ReputationBar />
            </div>
        </header>
    );
}

function MobileBottomNav({ activeTab, onTabChange }: { activeTab: MobileTab; onTabChange: (tab: MobileTab) => void }) {
    return (
        <nav className="flex border-t bg-card shrink-0" style={{ minHeight: '52px' }}>
            {MOBILE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <Button
                        key={tab.id}
                        variant="ghost"
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-none h-auto py-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] leading-tight">{tab.label}</span>
                    </Button>
                );
            })}
        </nav>
    );
}

export const JudicialLayout: React.FC = () => {
    const currentCase = useGameStore((state) => state.currentCase);
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<MobileTab>('defendant');

    if (!currentCase) {
        return <div className="flex items-center justify-center h-screen">Loading case data...</div>;
    }

    const stage = currentCase.game_state.current_stage;

    if (stage === 'Verdict') {
        return (
            <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
                <Header docket={currentCase.case_metadata.docket_number} stage={stage} />
                <div className="flex-1 overflow-auto">
                    <VerdictForm />
                </div>
            </div>
        );
    }

    if (stage === 'Sentencing') {
        return (
            <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
                <Header docket={currentCase.case_metadata.docket_number} stage={stage} />
                <div className="flex-1 overflow-auto">
                    <SentencingForm />
                </div>
            </div>
        );
    }

    if (isMobile) {
        return (
            <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
                <Header docket={currentCase.case_metadata.docket_number} stage={currentCase.game_state.current_stage} />
                <main className="flex-1 overflow-auto">
                    {activeTab === 'defendant' && (
                        <div className="h-full p-2">
                            <DefendantPanel defendant={currentCase.defendant} />
                        </div>
                    )}
                    {activeTab === 'transcript' && <TranscriptArea />}
                    {activeTab === 'motions' && <MotionTray />}
                    {activeTab === 'casefile' && (
                        <div className="h-full p-2">
                            <CaseFilePanel caseData={currentCase} />
                        </div>
                    )}
                </main>
                <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
            <Header docket={currentCase.case_metadata.docket_number} stage={currentCase.game_state.current_stage} />

            <ResizablePanelGroup orientation="horizontal" className="flex-1">
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <DefendantPanel defendant={currentCase.defendant} />
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={60}>
                    <ResizablePanelGroup orientation="vertical">
                        <ResizablePanel defaultSize={80}>
                            <TranscriptArea />
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        <ResizablePanel defaultSize={20} minSize={15}>
                            <MotionTray />
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <CaseFilePanel caseData={currentCase} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};