import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import type { SentenceRuling } from '../../types/game';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';

const CONDITION_OPTIONS = ['Probation', 'Community Service', 'Restitution', 'No Contact Order', 'Drug Treatment Program', 'Anger Management'];

export const SentencingForm: React.FC = () => {
    const currentCase = useGameStore((s) => s.currentCase);
    const submitSentence = useGameStore((s) => s.submitSentence);

    const [months, setMonths] = useState(0);
    const [conditions, setConditions] = useState<string[]>([]);
    const [reasoning, setReasoning] = useState('');

    if (!currentCase) return null;

    const verdictRulings = currentCase.verdict_rulings || [];
    const guiltyCharges = currentCase.charges.filter((c) => {
        const v = verdictRulings.find(vr => vr.chargeId === c.code);
        return v && (v.verdict === 'Guilty' || v.verdict === 'No Contest');
    });

    if (guiltyCharges.length === 0) {
        return (
            <div className="p-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No guilty verdicts require sentencing.</p>
                        <Button className="w-full mt-4" onClick={() => {
                            submitSentence({ months: 0, conditions: [], reasoning: 'No guilty verdicts to sentence.' });
                        }}>
                            Proceed to Outcome
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const minMonths = Math.min(...guiltyCharges.map(c => c.min_sentence_months));
    const maxMonths = Math.max(...guiltyCharges.map(c => c.max_sentence_months));
    const initializedMonths = months === 0 ? minMonths : months;

    const toggleCondition = (condition: string) => {
        setConditions((prev) =>
            prev.includes(condition)
                ? prev.filter((c) => c !== condition)
                : [...prev, condition]
        );
    };

    const isFormValid = reasoning.trim().length >= 10 && initializedMonths >= minMonths && initializedMonths <= maxMonths;

    const handleSubmit = () => {
        const sentence: SentenceRuling = {
            months: initializedMonths,
            conditions,
            reasoning,
        };
        submitSentence(sentence);
    };

    return (
        <div className="p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Sentencing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {guiltyCharges.map((charge) => (
                        <div key={charge.code}>
                            <p className="font-semibold">{charge.code}: {charge.description}</p>
                            <p className="text-xs text-muted-foreground">
                                Range: {charge.min_sentence_months}–{charge.max_sentence_months} months
                            </p>
                        </div>
                    ))}

                    <div className="space-y-3">
                        <Label>
                            Sentence Duration: <strong>{initializedMonths} months</strong>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Statutory range: {minMonths}–{maxMonths} months
                        </p>
                        <Slider
                            value={[initializedMonths]}
                            onValueChange={(v) => setMonths(v[0])}
                            min={minMonths}
                            max={maxMonths}
                            step={1}
                            className="py-2"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Conditions</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {CONDITION_OPTIONS.map((condition) => (
                                <div key={condition} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`condition-${condition}`}
                                        checked={conditions.includes(condition)}
                                        onCheckedChange={() => toggleCondition(condition)}
                                    />
                                    <Label htmlFor={`condition-${condition}`} className="text-sm font-normal">
                                        {condition}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sentencing-reasoning">Reasoning (min 10 chars)</Label>
                        <Textarea
                            id="sentencing-reasoning"
                            placeholder="Enter your sentencing reasoning..."
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleSubmit} disabled={!isFormValid} className="w-full">
                        Pass Sentence
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};