import React, { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { MotionReviewDialog } from "./MotionReviewDialog";
import type { Motion } from '../../types/game';

const statusVariant: Record<Motion['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
    Pending: 'secondary',
    Granted: 'default',
    Denied: 'destructive',
    Modified: 'outline',
};

export const MotionTray: React.FC = () => {
    const currentCase = useGameStore((s) => s.currentCase);
    const [selectedMotion, setSelectedMotion] = useState<Motion | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const motions = currentCase?.motions ?? [];
    const pendingCount = motions.filter((m) => m.status === 'Pending').length;

    const handleMotionClick = (motion: Motion) => {
        setSelectedMotion(motion);
        setIsDialogOpen(true);
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setSelectedMotion(null);
    };

    if (!currentCase || motions.length === 0) {
        return (
            <div className="h-full flex flex-col bg-background border-t">
                <div className="p-2 border-b bg-muted/20 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Action Tray</h3>
                </div>
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
                    No motions pending.
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="h-full flex flex-col bg-background border-t">
                <div className="p-2 border-b bg-muted/20 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Action Tray</h3>
                    <span className="text-xs text-muted-foreground">{pendingCount} Pending</span>
                </div>
                <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-1 gap-2">
                        {motions.map((motion) => (
                            <Button
                                key={motion.id}
                                variant={motion.status === 'Pending' ? 'secondary' : 'ghost'}
                                className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                onClick={() => handleMotionClick(motion)}
                                disabled={motion.status !== 'Pending'}
                            >
                                <div className="flex justify-between w-full">
                                    <span className="font-bold text-sm">{motion.title}</span>
                                    <Badge variant={statusVariant[motion.status]} className="text-xs">
                                        {motion.status}
                                    </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground line-clamp-1 text-left w-full">
                                    {motion.description}
                                </span>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            <MotionReviewDialog
                open={isDialogOpen}
                onOpenChange={handleDialogClose}
                motion={selectedMotion}
            />
        </>
    );
};