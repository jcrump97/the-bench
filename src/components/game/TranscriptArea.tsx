import React from 'react';
import { useGameStore } from '../../store/game-store';
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import { NarrativeText } from "../ui/narrative-text";
import type { TranscriptEntry as GameTranscriptEntry } from '../../types/game';

type TranscriptEntry = Omit<GameTranscriptEntry, 'timestamp' | 'type'> & {
    role: 'Judge' | 'Prosecution' | 'Defense' | 'System';
};

const FALLBACK_TRANSCRIPT: TranscriptEntry[] = [
    { id: '1', speaker: 'System', role: 'System', text: 'Court is now in session. The Honorable Judge AI presiding.' },
    { id: '2', speaker: 'Judge', role: 'Judge', text: 'Counsel, are we ready to proceed with opening statements?' },
    { id: '3', speaker: 'Prosecution', role: 'Prosecution', text: 'The State is ready, Your Honor. We intend to prove the defendant acted with clear intent.' },
    { id: '4', speaker: 'Defense', role: 'Defense', text: 'The Defense is ready, Your Honor. We argue this was a clear case of self-defense.' },
    { id: '5', speaker: 'Judge', role: 'Judge', text: 'Very well. Mr. Prosecutor, you may begin.' },
];

function mapTranscriptRole(type: string): TranscriptEntry['role'] {
    if (type === 'ruling') return 'Judge';
    if (type === 'procedure') return 'System';
    return 'Defense';
}

function storeTranscriptToLocal(entries: GameTranscriptEntry[]): TranscriptEntry[] {
    return entries.map((e) => ({
        id: e.id,
        speaker: e.speaker,
        role: mapTranscriptRole(e.type),
        text: e.text,
    }));
}

export const TranscriptArea: React.FC = () => {
    const currentCase = useGameStore((state) => state.currentCase);
    const transcriptEntries = (currentCase?.transcript?.length ?? 0) > 0
        ? storeTranscriptToLocal(currentCase!.transcript)
        : FALLBACK_TRANSCRIPT;

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b bg-card/50 backdrop-blur z-10">
                <h2 className="font-semibold text-sm text-center text-muted-foreground uppercase tracking-widest">Court/Transcript</h2>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-4 pb-4">
                    {transcriptEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className={cn(
                                "flex flex-col max-w-[80%] rounded-lg p-3 text-sm",
                                entry.role === 'Judge' && "self-center bg-primary/10 text-center border font-bold w-full max-w-[90%]",
                                entry.role === 'Prosecution' && "self-end bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-br-none",
                                entry.role === 'Defense' && "self-start bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 rounded-bl-none",
                                entry.role === 'System' && "self-center text-xs text-muted-foreground italic my-2 w-full text-center"
                            )}
                        >
                            {entry.role !== 'System' && entry.role !== 'Judge' && (
                                <span className={cn(
                                    "text-xs font-bold mb-1 opacity-70",
                                    entry.role === 'Prosecution' ? "text-right" : "text-left"
                                )}>
                                    {entry.speaker}
                                </span>
                            )}
                            <NarrativeText text={entry.text} title={`${entry.speaker} (${entry.role})`} />
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};