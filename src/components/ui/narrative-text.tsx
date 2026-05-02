import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";
import { ScrollArea } from "./scroll-area";
import { cn } from "../../lib/utils";
import { BookOpen } from "lucide-react";

interface NarrativeTextProps {
    title?: string;
    text: string;
    maxLength?: number;
    className?: string;
}

export const NarrativeText: React.FC<NarrativeTextProps> = ({
    title = "Narrative Details",
    text,
    maxLength = 100,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // If text is short, just render it normally
    if (text.length <= maxLength) {
        return <p className={cn("text-sm text-foreground", className)}>{text}</p>;
    }

    return (
        <>
            <div
                className={cn(
                    "group relative cursor-pointer rounded-md border border-transparent hover:bg-muted/50 p-2 -ml-2 transition-colors",
                    className
                )}
                onClick={() => setIsOpen(true)}
                role="button"
                aria-label={`Read full text: ${title}`}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        setIsOpen(true);
                    }
                }}
            >
                <p className="text-sm text-foreground line-clamp-3">
                    {text}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 opacity-70 group-hover:text-primary group-hover:opacity-100 transition-all font-medium">
                    <BookOpen className="w-3 h-3" />
                    <span>Click to read more...</span>
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>Full text view</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-2 p-1 pr-4">
                        <div className="text-base leading-relaxed space-y-4">
                            {text.split('\n').map((paragraph, index) => (
                                <p key={index}>{paragraph}</p>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </>
    );
};
