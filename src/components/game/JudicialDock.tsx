import React from 'react';
import { Button } from '../ui/button';
import { User, FileText, Gavel, Scale } from 'lucide-react';

interface JudicialDockProps {
    onOpenDefendant: () => void;
    onOpenEvidence: () => void;
    onOpenMotions: () => void;
    onIssueRuling: () => void;
}

export const JudicialDock: React.FC<JudicialDockProps> = ({
    onOpenDefendant,
    onOpenEvidence,
    onOpenMotions,
    onIssueRuling
}) => {
    return (
        <div className="h-16 border-t bg-card flex items-center justify-between px-6 shadow-up-lg z-50">
            <div className="flex items-center gap-2">
                <Button variant="ghost" className="flex gap-2" onClick={onOpenDefendant}>
                    <User className="w-5 h-5" />
                    Defendant
                </Button>
                <Button variant="ghost" className="flex gap-2" onClick={onOpenEvidence}>
                    <FileText className="w-5 h-5" />
                    Evidence
                </Button>
                <Button variant="ghost" className="flex gap-2" onClick={onOpenMotions}>
                    <Scale className="w-5 h-5" />
                    Motions
                </Button>
            </div>

            <div className="flex-1 text-center text-sm text-muted-foreground font-mono">
                THE BENCH // JUDICIAL CHAMBER
            </div>

            <div>
                <Button size="lg" className="gap-2 font-bold" onClick={onIssueRuling}>
                    <Gavel className="w-5 h-5" />
                    Issue Ruling
                </Button>
            </div>
        </div>
    );
};
