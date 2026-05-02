import { getGeminiModel } from './client';
import { CourtCaseSchema, CaseOutcomeSchema } from './schemas';
import type { CourtCase, CaseOutcome } from '../../types/game';

function generateDemoOutcome(caseData: CourtCase): CaseOutcome {
    const guiltyCount = caseData.verdict_rulings?.filter(v => v.verdict === 'Guilty').length || 0;
    const totalCharges = caseData.charges.length;
    const sentence = caseData.sentence_ruling;
    const allNotGuilty = caseData.verdict_rulings?.every(v => v.verdict === 'Not Guilty') ?? false;

    let verdictStr: string;
    if (allNotGuilty) {
        verdictStr = `Not Guilty on all ${totalCharges} charges.`;
    } else if (guiltyCount === totalCharges) {
        verdictStr = `Guilty on all ${totalCharges} charges.`;
    } else {
        verdictStr = `Guilty on ${guiltyCount} of ${totalCharges} charges.`;
    }

    return {
        verdict: verdictStr,
        sentence: sentence ? `${sentence.months} months${sentence.conditions.length ? `. Conditions: ${sentence.conditions.join(', ')}` : ''}` : undefined,
        rationale: `The court considered the evidence presented and the defendant's conduct during proceedings.`,
        public_reaction: (caseData.game_state.presiding_judge_reputation ?? 100) > 70 ? "Public trusts the court's judgment." : 'Mixed public reaction to the ruling.',
    };
}

export async function generateOutcome(caseData: CourtCase, isDemoMode: boolean, apiKey?: string, decision?: string): Promise<CaseOutcome> {
    if (isDemoMode) {
        return generateDemoOutcome(caseData);
    }

    if (!apiKey) {
        throw new Error('API key is required for live mode.');
    }

    const { docket_number, charges, defendant } = caseData.case_metadata
        ? { docket_number: caseData.case_metadata.docket_number, charges: caseData.charges, defendant: caseData.defendant }
        : { docket_number: 'Unknown', charges: caseData.charges, defendant: caseData.defendant };

    const verdicts = caseData.verdict_rulings?.map(v => `${v.chargeId}: ${v.verdict}`).join(', ') ?? 'No verdicts';
    const sentence = caseData.sentence_ruling
        ? `${caseData.sentence_ruling.months} months`
        : 'No sentence';

    const prompt = `
You are an AI Judge Review Board for a judicial simulation game called "The Bench".
Review the following case and generate a narrative outcome.

Case Docket: ${docket_number}
Defendant: ${defendant.name}
Charges: ${charges.map(c => c.description).join('; ')}
Verdicts: ${verdicts}
Sentence: ${sentence}
${decision ? `Judge's Reasoning: ${decision}` : ''}

Generate an outcome object strictly adhering to this JSON schema:
{
  "verdict": "string",
  "sentence": "string",
  "rationale": "string",
  "public_reaction": "string"
}
`;

    const model = getGeminiModel(apiKey);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
        const json = JSON.parse(text);
        return CaseOutcomeSchema.parse(json);
    } catch (error) {
        console.error("Failed to parse Gemini outcome:", text, error);
        throw new Error("Failed to generate a valid case outcome.");
    }
}

export const generateNewCase = async (apiKey: string): Promise<CourtCase> => {
  const model = getGeminiModel(apiKey);

  const prompt = `
    You are an AI Dungeon Master for a judicial simulation game called "The Bench".
    Generate a new, unique felony court case.
    The case should be realistic, with ambiguous elements that challenge the judge (player).
    
    Structure the response strictly according to this JSON schema:
    {
      "case_metadata": { "docket_number": "string", "charge_level": "string", "presiding_judge_reputation_stake": number },
      "defendant": { "name": "string", "demographics": "string", "prior_history": ["string"], "flight_risk_score": number, "public_trust_impact": "High" | "Med" | "Low" },
      "charges": [{ "code": "string", "description": "string", "min_sentence_months": number, "max_sentence_months": number }],
      "evidence": [{ "id": "string", "description": "string", "type": "string", "prosecution_argument": "string", "defense_argument": "string", "admissibility_status": "Pending", "strength": "Low" | "Med" | "High" }],
      "witnesses": [{ "id": "string", "name": "string", "role": "string", "credibility_score": number, "key_testimony": "string" }],
      "game_state": { "current_stage": "Arraignment", "is_mistrial": false, "defense_attorney_aggression": number, "prosecutor_competence": number }
    }
    
    Ensure "admissibility_status" is always "Pending" for new evidence.
    Ensure "strength" reflects how strong or weak each piece of evidence is, with mixed values.
    Ensure "current_stage" is "Arraignment".
    
    IMPORTANT CONSTRAINTS:
    - "presiding_judge_reputation_stake" MUST be an integer between 1 and 10.
    - "public_trust_impact" MUST be exactly one of: "High", "Med", "Low". Do not use "Medium".
    - "flight_risk_score" MUST be an integer between 1 and 10.
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  try {
    const json = JSON.parse(text);
    const data = Array.isArray(json) ? json[0] : json;
    return CourtCaseSchema.parse(data) as CourtCase;
  } catch (error) {
    console.error("Failed to parse Gemini response:", text, error);
    throw new Error("Failed to generate a valid court case.");
  }
};
