import React, { useState } from 'react';

import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { MotionReviewDialog } from "./MotionReviewDialog";

const MOCK_MOTIONS = [
    { id: 'm1', title: 'Motion to Limine', type: 'Limine', description: 'Defense requests exclusion of prior bad acts evidence as prejudicial.' },
    { id: 'm2', title: 'Motion to Dismiss', type: 'Dismissal', description: 'Defense argues lack of probable cause based on initial police report discrepancies.' },
];

export const MotionTray: React.FC = () => {
    const [selectedMotion, setSelectedMotion] = useState<typeof MOCK_MOTIONS[0] | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleMotionClick = (motion: typeof MOCK_MOTIONS[0]) => {
        setSelectedMotion(motion);
        setIsDialogOpen(true);
    };

    return (
        <>
            <div className="h-full flex flex-col bg-background border-t">
                <div className="p-2 border-b bg-muted/20 flex justify-between items-center">
                    <h3 className="font-semibold text-sm">Action Tray</h3>
                    <span className="text-xs text-muted-foreground">{MOCK_MOTIONS.length} Pending</span>
                </div>
                <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-1 gap-2">
                        {MOCK_MOTIONS.map((motion) => (
                            <Button
                                key={motion.id}
                                variant="secondary"
                                className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1"
                                onClick={() => handleMotionClick(motion)}
                            >
                                <div className="flex justify-between w-full">
                                    <span className="font-bold text-sm">{motion.title}</span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{motion.type}</span>
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
                onOpenChange={setIsDialogOpen}
                motion={selectedMotion}
            />
        </>
    );
};
