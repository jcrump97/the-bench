import React from 'react';
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

interface MotionReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    motion: {
        id: string;
        title: string;
        type: string;
        description: string;
    } | null;
}

export const MotionReviewDialog: React.FC<MotionReviewDialogProps> = ({ open, onOpenChange, motion }) => {
    if (!motion) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                        placeholder="Enter your ruling reasoning here..."
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Deny Motion</Button>
                    <Button onClick={() => onOpenChange(false)}>Grant Motion</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
