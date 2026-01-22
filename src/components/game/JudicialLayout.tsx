import React from 'react';
import type { CourtCase } from '../../types/game';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "../ui/resizable";
import { ScrollArea } from "../ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface JudicialLayoutProps {
    caseData: CourtCase;
}

export const JudicialLayout: React.FC<JudicialLayoutProps> = ({ caseData }) => {
    return (
        <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col">
            <header className="p-3 border-b flex justify-between items-center bg-card z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold">The Bench: Judicial Chamber</h1>
                    <Badge variant="outline">Case: {caseData.case_metadata.docket_number}</Badge>
                    <Badge variant="secondary">{caseData.game_state.current_stage}</Badge>
                </div>
            </header>

            <ResizablePanelGroup orientation="horizontal" className="flex-1">
                {/* Left Panel: Defense Strategy (20%) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <Card className="h-full border-none shadow-none bg-transparent">
                            <CardHeader>
                                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Defense Strategy</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm italic text-muted-foreground">Defense counsel is reviewing discovery...</p>
                            </CardContent>
                        </Card>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Center Panel: Transcript & Action Tray (60%) */}
                <ResizablePanel defaultSize={60}>
                    <ResizablePanelGroup orientation="vertical">
                        {/* Transcript Area (80%) */}
                        <ResizablePanel defaultSize={80}>
                            <div className="h-full flex flex-col">
                                <div className="p-2 border-b bg-card/50 backdrop-blur">
                                    <h2 className="font-semibold text-sm">Court Transcript</h2>
                                </div>
                                <ScrollArea className="flex-1 p-4">
                                    <div className="flex flex-col gap-4">
                                        {/* Placeholder for transcript entries */}
                                        <div className="text-sm text-muted-foreground text-center py-10">
                                            - Court is in session -
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        {/* Action Tray (20%) */}
                        <ResizablePanel defaultSize={20} minSize={15}>
                            <div className="h-full p-4 bg-background">
                                <h3 className="font-semibold text-sm mb-2">Pending Orders / Action Tray</h3>
                                <div className="text-sm text-muted-foreground italic">
                                    No pending motions.
                                </div>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Prosecution Strategy (20%) */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                    <div className="h-full flex flex-col p-2 bg-muted/10">
                        <Card className="h-full border-none shadow-none bg-transparent">
                            <CardHeader>
                                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Prosecution Strategy</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm italic text-muted-foreground">The State is preparing its opening statement...</p>
                            </CardContent>
                        </Card>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};
