import React, { useEffect, useRef } from 'react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CollapsiblePanelProps {
  side: 'left' | 'right';
  icon: LucideIcon;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  side,
  icon: Icon,
  label,
  isOpen,
  onToggle,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const isLeft = side === 'left';

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onToggle]);

  // Focus trap: auto-focus panel when opened
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable?.focus();
    }
  }, [isOpen]);

  return (
    <div
      className={`relative flex-shrink-0 h-full bg-card transition-all duration-500 ease-out ${
        isLeft ? 'border-r' : 'border-l'
      } ${isOpen ? 'w-[320px] opacity-100' : 'w-[48px] opacity-100'}`}
      style={{ zIndex: isOpen ? 20 : 10 }}
      aria-expanded={isOpen}
      role="region"
      aria-label={label}
    >
      {/* Collapsed bar */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={`w-full h-full flex flex-col items-center pt-4 gap-2 hover:bg-muted/50 transition-colors cursor-pointer border-0 bg-transparent`}
          aria-label={`Open ${label}`}
        >
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <span
            className="text-[10px] text-muted-foreground font-medium leading-tight"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: isLeft ? 'rotate(180deg)' : undefined,
            }}
          >
            {label}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div ref={panelRef} className="h-full flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{label}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label={`Close ${label}`}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {children}
            </div>
          </ScrollArea>

          {/* Chevron hint at edge */}
          <button
            onClick={onToggle}
            className={`absolute top-1/2 -translate-y-1/2 ${isLeft ? '-right-3' : '-left-3'} w-6 h-12 flex items-center justify-center bg-card border rounded-full shadow-sm hover:bg-muted transition-colors z-30`}
            aria-label={`Collapse ${label}`}
          >
            {isLeft ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  );
};
