import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import type { ArraignmentRuling } from '../../types/game';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';

const BOND_CONDITIONS = [
    "Surrender Passport",
    "No Contact with Victim/Witnesses",
    "Electronic Monitoring",
    "Curfew (10PM - 6AM)",
    "Substance Abuse Testing",
    "Maintain Employment"
];

export const ArraignmentControls: React.FC = () => {
    const { submitArraignmentRuling } = useGameStore();

    const [bailType, setBailType] = useState<"ROR" | "Cash" | "Remand">("ROR");
    const [bailAmount, setBailAmount] = useState<number>(0);
    const [conditions, setConditions] = useState<string[]>([]);
    const [reasoning, setReasoning] = useState<string>('');

    const handleSubmit = () => {
        const ruling: ArraignmentRuling = {
            bailType,
            bailAmount: bailType === 'Cash' ? bailAmount : undefined,
            conditions,
            rulingReasoning: reasoning
        };
        submitArraignmentRuling(ruling);
    };

    const handleConditionToggle = (condition: string) => {
        setConditions(prev =>
            prev.includes(condition)
                ? prev.filter(c => c !== condition)
                : [...prev, condition]
        );
    };

    return (
        <Card className="w-full mt-4 border-t-2 border-primary">
            <CardHeader>
                <CardTitle>Judicial Ruling: Arraignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Bail Type Selection */}
                <div className="space-y-2">
                    <Label htmlFor="bail-type">Bail / Bond Decision</Label>
                    <Select onValueChange={(val: "ROR" | "Cash" | "Remand") => setBailType(val)} defaultValue="ROR">
                        <SelectTrigger className="w-full md:w-[280px]">
                            <SelectValue placeholder="Select Ruling" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ROR">Release on Recognizance (ROR)</SelectItem>
                            <SelectItem value="Cash">Set Bail Amount</SelectItem>
                            <SelectItem value="Remand">Remand to Custody (No Bail)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Bail Amount Slider (Only if Cash Bail) */}
                {bailType === "Cash" && (
                    <div className="space-y-4 p-4 border rounded-md bg-muted/20 animate-in fade-in slide-in-from-top-2">
                        <Label>Bail Amount: ${bailAmount.toLocaleString()}</Label>
                        <div className="flex gap-4 items-center">
                            <Slider
                                defaultValue={[0]}
                                max={1000000}
                                step={1000}
                                value={[bailAmount]}
                                onValueChange={(vals) => setBailAmount(vals[0])}
                                className="flex-1"
                            />
                            <Input
                                type="number"
                                className="w-[120px]"
                                value={bailAmount}
                                onChange={(e) => setBailAmount(Number(e.target.value))}
                                max={1000000}
                            />
                        </div>
                    </div>
                )}

                {/* Bond Conditions */}
                {bailType !== "Remand" && (
                    <div className="space-y-2">
                        <Label>Bond Conditions</Label>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {BOND_CONDITIONS.map((condition) => (
                                <div key={condition} className="flex items-center space-x-2 border p-2 rounded hover:bg-muted/50 transition-colors">
                                    <Checkbox
                                        id={condition}
                                        checked={conditions.includes(condition)}
                                        onCheckedChange={() => handleConditionToggle(condition)}
                                    />
                                    <Label htmlFor={condition} className="text-sm cursor-pointer w-full">{condition}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Reasoning */}
                <div className="space-y-2">
                    <Label htmlFor="reasoning">Judicial Reasoning (Required)</Label>
                    <Textarea
                        id="reasoning"
                        placeholder="State for the record why you made this specific determination..."
                        className="min-h-[100px]"
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                    />
                </div>

                <Button
                    size="lg"
                    className="w-full md:w-auto font-bold text-lg"
                    onClick={handleSubmit}
                    disabled={!reasoning.trim() || (bailType === 'Cash' && bailAmount <= 0)}
                >
                    Issue Ruling
                </Button>
            </CardContent>
        </Card>
    );
};
