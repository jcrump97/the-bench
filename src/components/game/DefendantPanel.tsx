import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import type { Defendant } from '../../types/game';

interface DefendantPanelProps {
    defendant: Defendant;
}

export const DefendantPanel: React.FC<DefendantPanelProps> = ({ defendant }) => {
    return (
        <Card className="h-full w-full border-none shadow-none bg-transparent flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    Defendant Profile
                    <Badge variant={defendant.flight_risk_score > 7 ? "destructive" : "secondary"}>
                        Risk: {defendant.flight_risk_score}/10
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 pt-0">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-bold">{defendant.name}</h3>
                        <p className="text-sm text-muted-foreground">{defendant.demographics}</p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-primary">Prior History</h4>
                        <ScrollArea className="h-[200px] w-full rounded-md border p-2 bg-muted/20">
                            {defendant.prior_history.length > 0 ? (
                                <ul className="space-y-2">
                                    {defendant.prior_history.map((record, index) => (
                                        <li key={index} className="text-sm flex items-start gap-2">
                                            <span className="text-muted-foreground">•</span>
                                            <span>{record}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No prior history on record.</p>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Public Trust Impact:</span>
                            <Badge variant="outline">{defendant.public_trust_impact}</Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
