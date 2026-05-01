import React, { useEffect, useRef } from 'react';
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { useGameStore } from '../../store/game-store';
import type { TranscriptEntry } from '../../types/game';

const ENTRY_STYLES: Record<TranscriptEntry['type'], string> = {
    testimony: "self-start bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 rounded-bl-none",
    ruling: "self-center bg-primary/10 text-center border font-bold w-full max-w-[90%]",
    procedure: "self-center text-xs text-muted-foreground italic my-2 w-full text-center",
};

const SPEAKER_COLORS: Record<string, string> = {
    Judge: "text-primary",
    Prosecution: "text-right text-slate-700 dark:text-slate-300",
    Defense: "text-left text-blue-700 dark:text-blue-300",
    System: "",
};

export const TranscriptArea: React.FC = () => {
    const transcript = useGameStore((state) => state.currentCase?.transcript ?? []);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }
    }, [transcript.length]);

    if (transcript.length === 0) {
        return (
            <div className="h-full flex flex-col">
                <div className="p-2 border-b bg-card/50 backdrop-blur z-10">
                    <h2 className="font-semibold text-sm text-center text-muted-foreground uppercase tracking-widest">Court Transcript</h2>
                </div>
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
                    Awaiting proceedings...
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b bg-card/50 backdrop-blur z-10">
                <h2 className="font-semibold text-sm text-center text-muted-foreground uppercase tracking-widest">Court Transcript</h2>
            </div>
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="flex flex-col gap-4 pb-4">
                    {transcript.map((entry) => (
                        <div
                            key={entry.id}
                            className={cn(
                                "flex flex-col max-w-[80%] rounded-lg p-3 text-sm",
                                ENTRY_STYLES[entry.type],
                            )}
                        >
                            {entry.type !== 'procedure' && (
                                <span
                                    className={cn(
                                        "text-xs font-bold mb-1 opacity-70",
                                        SPEAKER_COLORS[entry.speaker] ?? "text-left",
                                    )}
                                >
                                    {entry.speaker}
                                </span>
                            )}
                            <p>{entry.text}</p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};