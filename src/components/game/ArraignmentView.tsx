import React from 'react';
import type { CourtCase } from '../../types/game';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArraignmentControls } from './ArraignmentControls';

interface ArraignmentViewProps {
    caseData: CourtCase;
}

export const ArraignmentView: React.FC<ArraignmentViewProps> = ({ caseData }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full h-full p-4">
            {/* Left Panel: Defendant Info */}
            <Card className="col-span-1 border-border bg-card">
                <CardHeader>
                    <CardTitle>Defendant</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-sm text-foreground/70 uppercase">Name</h4>
                        <p className="text-lg">{caseData.defendant.name}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-foreground/70 uppercase">Details</h4>
                        <p className="text-sm">{caseData.defendant.demographics}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-foreground/70 uppercase">Flight Risk</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold">{caseData.defendant.flight_risk_score}/10</span>
                            <Badge variant={caseData.defendant.flight_risk_score > 7 ? "destructive" : "secondary"}>
                                {caseData.defendant.flight_risk_score > 7 ? "High Risk" : "Standard"}
                            </Badge>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-foreground/70 uppercase">Prior History</h4>
                        <ul className="list-disc pl-4 text-sm">
                            {caseData.defendant.prior_history.map((record, index) => (
                                <li key={index}>{record}</li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
            </Card>

            {/* Center Panel: Evidence Summary */}
            <Card className="col-span-1 md:col-span-2 border-border bg-card">
                <CardHeader>
                    <CardTitle>Evidence Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {caseData.evidence.map((item) => (
                            <div key={item.id} className="p-3 border rounded-md bg-muted/20">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-sm">{item.type}</span>
                                    <Badge variant="outline">Admissibility: {item.admissibility_status}</Badge>
                                </div>
                                <p className="text-sm">{item.description}</p>
                                <div className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="font-bold">Pros:</span> {item.prosecution_argument}
                                    </div>
                                    <div>
                                        <span className="font-bold">Def:</span> {item.defense_argument}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Right Panel: Charges */}
            <Card className="col-span-1 border-border bg-card">
                <CardHeader>
                    <CardTitle>Charges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-2 bg-muted/50 rounded text-center">
                        <span className="text-xs font-bold uppercase">Docket</span>
                        <div className="text-lg font-mono">{caseData.case_metadata.docket_number}</div>
                    </div>

                    <div className="space-y-3">
                        {caseData.charges.map((charge, index) => (
                            <div key={index} className="border-b last:border-0 pb-3 last:pb-0">
                                <h4 className="font-bold text-red-600">{charge.code}</h4>
                                <p className="text-sm font-medium">{charge.description}</p>
                                <div className="mt-1 text-xs text-muted-foreground flex justify-between">
                                    <span>Min: {charge.min_sentence_months}m</span>
                                    <span>Max: {charge.max_sentence_months}m</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Controls Section - Full Width */}
            <div className="col-span-1 md:col-span-4 pb-8">
                {caseData.arraignment_ruling ? (
                    <Card className="w-full mt-4 border-t-2 border-primary bg-muted/10">
                        <CardHeader>
                            <CardTitle>Ruling Issued</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                <p><strong>Decision:</strong> {caseData.arraignment_ruling.bailType}
                                    {caseData.arraignment_ruling.bailAmount && ` ($${caseData.arraignment_ruling.bailAmount.toLocaleString()})`}
                                </p>
                                {caseData.arraignment_ruling.conditions.length > 0 && (
                                    <p><strong>Conditions:</strong> {caseData.arraignment_ruling.conditions.join(', ')}</p>
                                )}
                                <p className="italic text-muted-foreground">"{caseData.arraignment_ruling.rulingReasoning}"</p>
                                <div className="pt-4 border-t mt-4">
                                    <p className="text-sm text-center text-muted-foreground">The court has recessed. Awaiting pre-trial motions.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <ArraignmentControls />
                )}
            </div>
        </div>
    );
};
