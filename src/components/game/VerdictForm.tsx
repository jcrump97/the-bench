import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import type { ChargeVerdict } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';

export const VerdictForm: React.FC = () => {
    const currentCase = useGameStore((s) => s.currentCase);
    const submitVerdict = useGameStore((s) => s.submitVerdict);

    const [verdicts, setVerdicts] = useState<Record<string, { verdict: ChargeVerdict['verdict']; reasoning: string }>>({});

    if (!currentCase) return null;

    const charges = currentCase.charges;

    const handleVerdictSelect = (chargeCode: string, verdict: ChargeVerdict['verdict']) => {
        setVerdicts((prev) => ({
            ...prev,
            [chargeCode]: { ...prev[chargeCode], verdict },
        }));
    };

    const handleReasoningChange = (chargeCode: string, reasoning: string) => {
        setVerdicts((prev) => ({
            ...prev,
            [chargeCode]: { ...prev[chargeCode], reasoning },
        }));
    };

    const isFormValid = charges.every((charge) => {
        const v = verdicts[charge.code];
        return v && v.verdict && v.reasoning && v.reasoning.trim().length >= 10;
    });

    const handleSubmit = () => {
        const chargeVerdicts: ChargeVerdict[] = charges.map((charge) => ({
            chargeId: charge.code,
            verdict: verdicts[charge.code].verdict,
            reasoning: verdicts[charge.code].reasoning,
        }));
        submitVerdict(chargeVerdicts);
    };

    return (
        <div className="p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Render Verdict</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                        This verdict will impact your reputation. Review each charge and render your decision.
                    </p>
                    {charges.map((charge) => {
                        const v = verdicts[charge.code] || { verdict: undefined, reasoning: '' };
                        return (
                            <Card key={charge.code} className="border">
                                <CardContent className="pt-4 space-y-3">
                                    <div>
                                        <p className="font-semibold">{charge.code}</p>
                                        <p className="text-sm text-muted-foreground">{charge.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Sentence range: {charge.min_sentence_months}–{charge.max_sentence_months} months
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant={v.verdict === 'Guilty' ? 'default' : 'outline'}
                                            onClick={() => handleVerdictSelect(charge.code, 'Guilty')}
                                        >
                                            Guilty
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={v.verdict === 'Not Guilty' ? 'default' : 'outline'}
                                            onClick={() => handleVerdictSelect(charge.code, 'Not Guilty')}
                                        >
                                            Not Guilty
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={v.verdict === 'No Contest' ? 'default' : 'outline'}
                                            onClick={() => handleVerdictSelect(charge.code, 'No Contest')}
                                        >
                                            No Contest
                                        </Button>
                                    </div>
                                    <div>
                                        <Label htmlFor={`reasoning-${charge.code}`}>Reasoning (min 10 chars)</Label>
                                        <Textarea
                                            id={`reasoning-${charge.code}`}
                                            placeholder="Enter your reasoning for this verdict..."
                                            value={v.reasoning || ''}
                                            onChange={(e) => handleReasoningChange(charge.code, e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    <Button onClick={handleSubmit} disabled={!isFormValid} className="w-full">
                        Render Verdict
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};