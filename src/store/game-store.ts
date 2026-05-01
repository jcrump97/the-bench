import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { CourtCase, CaseOutcome, ArraignmentRuling, TranscriptEntry, Motion, Evidence, ChargeVerdict, SentenceRuling } from '../types/game';

function makeTranscriptEntry(speaker: string, text: string, type: TranscriptEntry['type']): TranscriptEntry {
    return {
        id: crypto.randomUUID(),
        speaker,
        text,
        timestamp: new Date().toISOString(),
        type,
    };
}

interface GameStoreState {
    apiKey: string | null;
    currentCase: CourtCase | null;
    caseHistory: CourtCase[];
    playerReputation: number;
    gameStage: 'landing' | 'arraignment' | 'motions' | 'evidence' | 'verdict' | 'sentencing' | 'outcome' | 'gameover';
    isDemoMode: boolean;

    setApiKey: (key: string) => void;
    setCurrentCase: (caseData: CourtCase) => void;
    resolveCurrentCase: (outcome: CaseOutcome) => void;
    submitArraignmentRuling: (ruling: ArraignmentRuling) => void;
    ruleMotion: (motionId: string, ruling: Motion['status'], reasoning: string) => void;
    ruleEvidence: (evidenceId: string, ruling: Evidence['admissibility_status'], reasoning: string) => void;
    submitVerdict: (verdicts: ChargeVerdict[]) => void;
    submitSentence: (sentence: SentenceRuling) => void;
    addTranscriptEntry: (entry: TranscriptEntry) => void;
    setCaseStage: (stage: string) => void;
    updateReputation: (amount: number) => void;
    setGameStage: (stage: 'landing' | 'arraignment' | 'motions' | 'evidence' | 'verdict' | 'sentencing' | 'outcome' | 'gameover') => void;
    setDemoMode: (isDemo: boolean) => void;
}

export const useGameStore = create<GameStoreState>()(
    devtools(
        persist(
            (set) => ({
                apiKey: null,
                currentCase: null,
                caseHistory: [],
                playerReputation: 100,
                gameStage: 'landing',
                isDemoMode: false,

                setApiKey: (key) => set({ apiKey: key }),

                setCurrentCase: (caseData) => set(() => {
                    const sessionEntry = makeTranscriptEntry('System', `Court is now in session. Docket: ${caseData.case_metadata.docket_number}.`, 'procedure');
                    const arraignmentEntry = makeTranscriptEntry('System', 'Proceeding to arraignment.', 'procedure');
                    const caseWithTranscript: CourtCase = {
                        ...caseData,
                        transcript: [...(caseData.transcript || []), sessionEntry, arraignmentEntry],
                    };
                    return { currentCase: caseWithTranscript };
                }),

                resolveCurrentCase: (outcome) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const completedCase: CourtCase = {
                            ...state.currentCase,
                            outcome,
                        };

                        return {
                            currentCase: null,
                            caseHistory: [...state.caseHistory, completedCase],
                        };
                    }),

                submitArraignmentRuling: (ruling) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const flightRisk = state.currentCase.defendant.flight_risk_score;
                        let reputationChange = 2;

                        if (flightRisk >= 8 && ruling.bailType === "ROR") {
                            reputationChange = -15;
                        } else if (flightRisk >= 8 && ruling.bailType === "Cash" && (ruling.bailAmount || 0) < 10000) {
                            reputationChange = -10;
                        } else if (flightRisk <= 3 && (ruling.bailAmount || 0) > 50000) {
                            reputationChange = -5;
                        }

                        const newReputation = Math.max(0, state.playerReputation + reputationChange);

                        const bailDescription = ruling.bailType === 'ROR'
                            ? 'Release on Recognizance'
                            : ruling.bailType === 'Remand'
                                ? 'Remand without bail'
                                : `Cash bail set at $${(ruling.bailAmount || 0).toLocaleString()}`;

                        const conditionsText = ruling.conditions.length > 0
                            ? ` Conditions: ${ruling.conditions.join(', ')}.`
                            : '';

                        const rulingEntries: TranscriptEntry[] = [
                            makeTranscriptEntry('System', 'Arraignment ruling issued.', 'procedure'),
                            makeTranscriptEntry('Judge', `Ruling: ${bailDescription}.${conditionsText}`, 'ruling'),
                            makeTranscriptEntry('Judge', ruling.rulingReasoning, 'ruling'),
                            makeTranscriptEntry('System', 'Court is now in session for Pre-Trial.', 'procedure'),
                        ];

                        return {
                            playerReputation: newReputation,
                            currentCase: {
                                ...state.currentCase,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: "Pre-Trial",
                                    presiding_judge_reputation: newReputation
                                },
                                arraignment_ruling: ruling,
                                transcript: [...(state.currentCase.transcript || []), ...rulingEntries]
                            }
                        };
                    }),

                ruleMotion: (motionId, ruling, reasoning) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const motion = state.currentCase.motions.find(m => m.id === motionId);
                        if (!motion) return state;

                        let reputationChange = 0;
                        const isMeritorious = motion.merit;

                        if (isMeritorious) {
                            reputationChange = ruling === 'Granted' ? 5 : (ruling === 'Denied' ? -8 : 3);
                        } else {
                            reputationChange = ruling === 'Denied' ? 5 : (ruling === 'Granted' ? -8 : 3);
                        }

                        if (ruling === 'Modified') {
                            reputationChange = Math.abs(reputationChange) > 3 ? Math.sign(reputationChange) * 3 : reputationChange;
                        }

                        const newReputation = Math.max(0, Math.min(100, state.playerReputation + reputationChange));

                        const rulingLabel = ruling === 'Granted' ? 'Granted' : ruling === 'Denied' ? 'Denied' : 'Modified';
                        const updatedMotions = state.currentCase.motions.map(m =>
                            m.id === motionId
                                ? { ...m, status: ruling, final_ruling_text: reasoning }
                                : m
                        );

                        const rulingEntries: TranscriptEntry[] = [
                            makeTranscriptEntry('System', `Motion: ${motion.title}`, 'procedure'),
                            makeTranscriptEntry('Judge', `Motion ${rulingLabel}. ${reasoning}`, 'ruling'),
                        ];

                        const allRuled = updatedMotions.every(m => m.status !== 'Pending');

                        const stageEntries: TranscriptEntry[] = allRuled
                            ? [makeTranscriptEntry('System', 'All motions ruled upon. Court will now consider evidence admissibility.', 'procedure')]
                            : [];

                        const newStage = allRuled ? 'Evidence' : state.currentCase.game_state.current_stage;

                        return {
                            playerReputation: newReputation,
                            currentCase: {
                                ...state.currentCase,
                                motions: updatedMotions,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: newStage,
                                    presiding_judge_reputation: newReputation,
                                },
                                transcript: [...(state.currentCase.transcript || []), ...rulingEntries, ...stageEntries],
                            }
                        };
                    }),

                ruleEvidence: (evidenceId, ruling, reasoning) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const evidenceItem = state.currentCase.evidence.find(e => e.id === evidenceId);
                        if (!evidenceItem) return state;

                        if (ruling !== 'Admitted' && ruling !== 'Suppressed') return state;

                        const strength = evidenceItem.strength;
                        const isStrong = strength === 'High';
                        const isWeak = strength === 'Low';

                        let reputationChange = 0;
                        if (isStrong) {
                            reputationChange = ruling === 'Admitted' ? 5 : -10;
                        } else if (isWeak) {
                            reputationChange = ruling === 'Suppressed' ? 2 : -5;
                        } else {
                            reputationChange = ruling === 'Admitted' ? 3 : -7;
                        }

                        const newReputation = Math.max(0, Math.min(100, state.playerReputation + reputationChange));

                        const updatedEvidence = state.currentCase.evidence.map(e =>
                            e.id === evidenceId
                                ? { ...e, admissibility_status: ruling, ruling_reasoning: reasoning }
                                : e
                        );

                        const rulingLabel = ruling === 'Admitted' ? 'Admitted' : 'Suppressed';
                        const rulingEntries: TranscriptEntry[] = [
                            makeTranscriptEntry('System', `Evidence Ruling: ${evidenceItem.description.slice(0, 80)}...`, 'procedure'),
                            makeTranscriptEntry('Judge', `Evidence ${rulingLabel}. ${reasoning}`, 'ruling'),
                        ];

                        const allRuled = updatedEvidence.every(e => e.admissibility_status !== 'Pending');

                        const stageEntries: TranscriptEntry[] = allRuled
                            ? [makeTranscriptEntry('System', 'All evidence ruled upon. Court will now proceed to verdict.', 'procedure')]
                            : [];

                        const newStage = allRuled ? 'Verdict' : state.currentCase.game_state.current_stage;

                        return {
                            playerReputation: newReputation,
                            currentCase: {
                                ...state.currentCase,
                                evidence: updatedEvidence,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: newStage,
                                    presiding_judge_reputation: newReputation,
                                },
                                transcript: [...(state.currentCase.transcript || []), ...rulingEntries, ...stageEntries],
                            }
                        };
                    }),

                addTranscriptEntry: (entry) =>
                    set((state) => {
                        if (!state.currentCase) return state;
                        return {
                            currentCase: {
                                ...state.currentCase,
                                transcript: [...(state.currentCase.transcript || []), entry]
                            }
                        };
                    }),

                submitVerdict: (verdicts) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        let totalReputationChange = 0;
                        const transcriptEntries: TranscriptEntry[] = [];

                        verdicts.forEach((v) => {
                            const charge = state.currentCase!.charges.find(c => c.code === v.chargeId);
                            const severity = charge?.severity || 'Med';

                            let change = 0;
                            if (v.verdict === 'Guilty') {
                                change = severity === 'High' ? 10 : severity === 'Low' ? 5 : 7;
                            } else if (v.verdict === 'Not Guilty') {
                                change = severity === 'High' ? -15 : severity === 'Low' ? -10 : -12;
                            } else {
                                change = 3;
                            }

                            totalReputationChange += change;

                            transcriptEntries.push(
                                makeTranscriptEntry('System', `Verdict on charge ${v.chargeId}: ${v.verdict}`, 'procedure'),
                                makeTranscriptEntry('Judge', `${v.verdict} on ${v.chargeId}. ${v.reasoning}`, 'ruling'),
                            );
                        });

                        transcriptEntries.push(
                            makeTranscriptEntry('System', 'The court will now proceed to sentencing.', 'procedure'),
                        );

                        const newReputation = Math.max(0, Math.min(100, state.playerReputation + totalReputationChange));

                        const newStage = newReputation <= 0 ? 'gameover' : 'Sentencing';

                        return {
                            playerReputation: newReputation,
                            gameStage: newReputation <= 0 ? 'gameover' : state.gameStage,
                            currentCase: {
                                ...state.currentCase,
                                verdict_rulings: verdicts,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: newStage,
                                    presiding_judge_reputation: newReputation,
                                },
                                transcript: [...(state.currentCase.transcript || []), ...transcriptEntries],
                            }
                        };
                    }),

                submitSentence: (sentence) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const charges = state.currentCase.charges;
                        const verdictRulings = state.currentCase.verdict_rulings || [];

                        const guiltyCharges = charges.filter((c) => {
                            const v = verdictRulings.find(vr => vr.chargeId === c.code);
                            return v && (v.verdict === 'Guilty' || v.verdict === 'No Contest');
                        });

                        let withinRange = true;
                        if (guiltyCharges.length > 0) {
                            const minRange = Math.min(...guiltyCharges.map(c => c.min_sentence_months));
                            const maxRange = Math.max(...guiltyCharges.map(c => c.max_sentence_months));
                            withinRange = sentence.months >= minRange && sentence.months <= maxRange;
                        }

                        const reputationChange = withinRange ? 5 : -8;

                        const conditionsText = sentence.conditions.length > 0
                            ? ` Conditions: ${sentence.conditions.join(', ')}.`
                            : '';

                        const rulingEntries: TranscriptEntry[] = [
                            makeTranscriptEntry('System', 'Sentencing ruling issued.', 'procedure'),
                            makeTranscriptEntry('Judge', `Sentence: ${sentence.months} months.${conditionsText} ${sentence.reasoning}`, 'ruling'),
                        ];

                        const newReputation = Math.max(0, Math.min(100, state.playerReputation + reputationChange));
                        const newStage = newReputation <= 0 ? 'gameover' : 'Outcome';

                        return {
                            playerReputation: newReputation,
                            gameStage: newReputation <= 0 ? 'gameover' : state.gameStage,
                            currentCase: {
                                ...state.currentCase,
                                sentence_ruling: sentence,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: newStage,
                                    presiding_judge_reputation: newReputation,
                                },
                                transcript: [...(state.currentCase.transcript || []), ...rulingEntries],
                            }
                        };
                    }),

                setCaseStage: (stage) =>
                    set((state) => {
                        if (!state.currentCase) return state;
                        const stageMessages: Record<string, string> = {
                            'Pre-Trial': 'Court is now in session for Pre-Trial.',
                            'Motions': 'Court will now hear pre-trial motions.',
                            'Evidence': 'Court will now consider evidence admissibility.',
                            'Verdict': 'The court will now hear closing arguments and render a verdict.',
                            'Sentencing': 'The court will now proceed to sentencing.',
                        };
                        const message = stageMessages[stage] ?? `Court proceeding to ${stage}.`;
                        const entry = makeTranscriptEntry('System', message, 'procedure');
                        return {
                            currentCase: {
                                ...state.currentCase,
                                game_state: {
                                    ...state.currentCase.game_state,
                                    current_stage: stage,
                                },
                                transcript: [...(state.currentCase.transcript || []), entry],
                            }
                        };
                    }),

                updateReputation: (amount) =>
                    set((state) => ({
                        playerReputation: Math.max(0, state.playerReputation + amount),
                    })),

                setGameStage: (stage) => set({ gameStage: stage }),

                setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
            }),
            {
                name: 'the-bench-storage',
                partialize: (state) => ({
                    apiKey: state.apiKey,
                    caseHistory: state.caseHistory,
                    playerReputation: state.playerReputation,
                    currentCase: state.currentCase,
                    gameStage: state.gameStage,
                    isDemoMode: state.isDemoMode,
                }),
            }
        )
    )
);
