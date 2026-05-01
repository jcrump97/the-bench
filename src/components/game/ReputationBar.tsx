import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { Badge } from '../ui/badge';

function getReputationColor(value: number): string {
    if (value >= 70) return 'bg-green-500';
    if (value >= 30) return 'bg-yellow-500';
    return 'bg-red-500';
}

function getReputationTextColor(value: number): string {
    if (value >= 70) return 'text-green-500';
    if (value >= 30) return 'text-yellow-500';
    return 'text-red-500';
}

function getReputationBadgeVariant(value: number): 'default' | 'secondary' | 'destructive' {
    if (value >= 70) return 'default';
    if (value >= 30) return 'secondary';
    return 'destructive';
}

export const ReputationBar: React.FC = () => {
    const playerReputation = useGameStore((state) => state.playerReputation);
    const [displayValue, setDisplayValue] = useState(playerReputation);
    const prevValueRef = useRef(playerReputation);

    useEffect(() => {
        if (prevValueRef.current === playerReputation) return;

        const start = displayValue;
        const end = playerReputation;
        const duration = 600;
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(Math.round(start + (end - start) * eased));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                prevValueRef.current = playerReputation;
            }
        };

        requestAnimationFrame(animate);
    }, [playerReputation]);

    const barColor = getReputationColor(playerReputation);
    const textColor = getReputationTextColor(playerReputation);
    const badgeVariant = getReputationBadgeVariant(playerReputation);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Reputation
            </span>
            <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: `${playerReputation}%` }}
                />
            </div>
            <Badge variant={badgeVariant} className={`${textColor} tabular-nums font-bold min-w-[3rem] justify-center`}>
                {displayValue}
            </Badge>
        </div>
    );
};