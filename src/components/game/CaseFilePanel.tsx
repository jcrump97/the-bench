import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import type { CourtCase } from '../../types/game';

interface CaseFilePanelProps {
    caseData: CourtCase;
}

export const CaseFilePanel: React.FC<CaseFilePanelProps> = ({ caseData }) => {
    return (
        <Card className="h-full w-full border-none shadow-none bg-transparent flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">
                    Case File
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <Tabs defaultValue="evidence" className="h-full flex flex-col">
                    <div className="px-4">
                        <TabsList className="w-full">
                            <TabsTrigger value="evidence" className="flex-1">Evidence</TabsTrigger>
                            <TabsTrigger value="witnesses" className="flex-1">Witnesses</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="evidence" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-2">
                        <ScrollArea className="flex-1 px-4 pb-4">
                            <div className="space-y-4">
                                {caseData.evidence.map((item) => (
                                    <div key={item.id} className="p-3 border rounded-md bg-card/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-sm">Exhibit {item.id}</span>
                                            <Badge variant={item.admissibility_status === 'Admitted' ? 'default' : 'outline'}>
                                                {item.admissibility_status}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2 font-mono">Type: {item.type}</div>
                                        <p className="text-sm">{item.description}</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="witnesses" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-2">
                        <ScrollArea className="flex-1 px-4 pb-4">
                            <div className="space-y-4">
                                {caseData.witnesses.map((witness) => (
                                    <div key={witness.id} className="p-3 border rounded-md bg-card/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-sm">{witness.name}</span>
                                            <Badge variant="outline">{witness.role}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-1">Key Testimony:</p>
                                        <p className="text-sm italic border-l-2 pl-2 border-primary/20">"{witness.key_testimony}"</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
