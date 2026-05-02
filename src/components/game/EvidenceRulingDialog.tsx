import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { useGameStore } from '../../store/game-store';
import { useToast } from '../../hooks/use-toast';
import type { Evidence } from '../../types/game';

interface EvidenceRulingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    evidence: Evidence | null;
}

const strengthLabels: Record<Evidence['strength'], string> = {
    High: 'Strong evidence',
    Med: 'Moderate evidence',
    Low: 'Weak evidence',
};

const strengthColors: Record<Evidence['strength'], 'default' | 'secondary' | 'outline'> = {
    High: 'default',
    Med: 'secondary',
    Low: 'outline',
};

export const EvidenceRulingDialog: React.FC<EvidenceRulingDialogProps> = ({ open, onOpenChange, evidence }) => {
    const ruleEvidence = useGameStore((s) => s.ruleEvidence);
    const [reasoning, setReasoning] = useState('');
    const { toast } = useToast();

    if (!evidence) return null;

    const handleAdmit = () => {
        const finalReasoning = reasoning.trim() || 'Evidence admitted as relevant and reliable.';
        ruleEvidence(evidence.id, 'Admitted', finalReasoning);

        const impact = calculateImpact(evidence, 'Admitted');
        toast({
            title: "Evidence Admitted",
            description: `Reputation: ${impact > 0 ? '+' : ''}${impact}`,
            variant: impact < 0 ? "destructive" : "default",
        });

        setReasoning('');
        onOpenChange(false);
    };

    const handleSuppress = () => {
        const finalReasoning = reasoning.trim() || 'Evidence suppressed as prejudicial or inadmissible.';
        ruleEvidence(evidence.id, 'Suppressed', finalReasoning);

        const impact = calculateImpact(evidence, 'Suppressed');
        toast({
            title: "Evidence Suppressed",
            description: `Reputation: ${impact > 0 ? '+' : ''}${impact}`,
            variant: impact < 0 ? "destructive" : "default",
        });

        setReasoning('');
        onOpenChange(false);
    };

    const calculateImpact = (e: Evidence, ruling: 'Admitted' | 'Suppressed'): number => {
        const s = e.strength;
        if (s === 'High') return ruling === 'Admitted' ? 5 : -10;
        if (s === 'Low') return ruling === 'Suppressed' ? 2 : -5;
        return ruling === 'Admitted' ? 3 : -7;
    };

    const admitImpact = calculateImpact(evidence, 'Admitted');
    const suppressImpact = calculateImpact(evidence, 'Suppressed');
    const impactLabel = (n: number) => n > 0 ? `+${n}` : `${n}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[625px] sm:w-auto sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Exhibit {evidence.id}
                        <Badge variant={strengthColors[evidence.strength]}>{evidence.strength} Strength</Badge>
                        <Badge variant="outline">{evidence.type}</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        {strengthLabels[evidence.strength]}. Rule on admissibility.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="border p-3 rounded bg-muted/50">
                        <p className="text-sm">{evidence.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="border p-3 rounded bg-red-950/20">
                            <span className="font-semibold block mb-1 text-xs text-red-400 uppercase tracking-wider">Prosecution</span>
                            <p className="text-sm">{evidence.prosecution_argument}</p>
                        </div>
                        <div className="border p-3 rounded bg-blue-950/20">
                            <span className="font-semibold block mb-1 text-xs text-blue-400 uppercase tracking-wider">Defense</span>
                            <p className="text-sm">{evidence.defense_argument}</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Judicial Reasoning</label>
                        <Textarea
                            placeholder="State your reasoning for the admissibility ruling..."
                            className="min-h-[100px]"
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            variant="destructive"
                            onClick={handleSuppress}
                            className="flex-1 sm:flex-none"
                        >
                            Suppress Evidence
                            <span className="ml-1 text-xs opacity-70">({impactLabel(suppressImpact)})</span>
                        </Button>
                        <Button
                            onClick={handleAdmit}
                            className="flex-1 sm:flex-none"
                        >
                            Admit Evidence
                            <span className="ml-1 text-xs opacity-70">({impactLabel(admitImpact)})</span>
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};