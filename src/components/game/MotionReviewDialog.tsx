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
import type { Motion } from '../../types/game';

interface MotionReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    motion: Motion | null;
    onGrant?: (motion: Motion, rulingText: string) => void;
    onDeny?: (motion: Motion, rulingText: string) => void;
}

export const MotionReviewDialog: React.FC<MotionReviewDialogProps> = ({ open, onOpenChange, motion, onGrant, onDeny }) => {
    const [rulingText, setRulingText] = useState('');

    if (!motion) return null;

    const handleGrant = () => {
        onGrant?.(motion, rulingText);
        setRulingText('');
        onOpenChange(false);
    };

    const handleDeny = () => {
        onDeny?.(motion, rulingText);
        setRulingText('');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) setRulingText('');
            onOpenChange(isOpen);
        }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Motion Review: {motion.title}</DialogTitle>
                    <DialogDescription className="text-sm border p-2 rounded bg-muted/50 mt-2">
                        <span className="font-semibold block mb-1">Argument:</span>
                        {motion.description}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="text-sm font-medium mb-1.5 block">Judicial Ruling / Reasoning</label>
                    <Textarea
                        value={rulingText}
                        onChange={(e) => setRulingText(e.target.value)}
                        placeholder="Enter your ruling reasoning here..."
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleDeny}>Deny Motion</Button>
                    <Button onClick={handleGrant}>Grant Motion</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};