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
import type { Motion } from '../../types/game';

interface MotionReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    motion: Motion | null;
}

const typeDescriptions: Record<Motion['type'], string> = {
    Suppression: 'Motion to Suppress — requests exclusion of specific evidence',
    Dismissal: 'Motion to Dismiss — requests dismissal of charges or case',
    Limine: 'Motion in Limine — requests pre-trial ruling on evidence admissibility',
};

export const MotionReviewDialog: React.FC<MotionReviewDialogProps> = ({ open, onOpenChange, motion }) => {
    const ruleMotion = useGameStore((s) => s.ruleMotion);
    const [reasoning, setReasoning] = useState('');

    if (!motion) return null;

    const handleRuling = (ruling: Motion['status']) => {
        ruleMotion(motion.id, ruling, reasoning || `Motion ${ruling.toLowerCase()}.`);
        setReasoning('');
        onOpenChange(false);
    };

    const reputationImpact = (ruling: Motion['status']) => {
        if (motion.status !== 'Pending') return 0;
        const isMerit = motion.merit;
        if (isMerit) {
            return ruling === 'Granted' ? 5 : ruling === 'Denied' ? -8 : 3;
        } else {
            return ruling === 'Denied' ? 5 : ruling === 'Granted' ? -8 : 3;
        }
    };

    const impactLabel = (impact: number) => impact > 0 ? `+${impact}` : `${impact}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {motion.title}
                        <Badge variant="outline">{motion.type}</Badge>
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        {typeDescriptions[motion.type]}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="border p-3 rounded bg-muted/50">
                        <span className="font-semibold block mb-1 text-sm">Argument:</span>
                        <p className="text-sm">{motion.description}</p>
                    </div>

                    <div className="border p-3 rounded bg-muted/30">
                        <span className="font-semibold block mb-1 text-sm">Proposed Order:</span>
                        <p className="text-sm italic">{motion.proposed_order_text}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Judicial Ruling / Reasoning</label>
                        <Textarea
                            placeholder="Enter your ruling reasoning here..."
                            className="min-h-[100px]"
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="destructive"
                            onClick={() => handleRuling('Denied')}
                            className="flex-1 sm:flex-none"
                        >
                            Deny Motion
                            <span className="ml-1 text-xs opacity-70">({impactLabel(reputationImpact('Denied'))})</span>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleRuling('Modified')}
                            className="flex-1 sm:flex-none"
                        >
                            Modify Motion
                            <span className="ml-1 text-xs opacity-70">({impactLabel(reputationImpact('Modified'))})</span>
                        </Button>
                        <Button
                            onClick={() => handleRuling('Granted')}
                            className="flex-1 sm:flex-none"
                        >
                            Grant Motion
                            <span className="ml-1 text-xs opacity-70">({impactLabel(reputationImpact('Granted'))})</span>
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};