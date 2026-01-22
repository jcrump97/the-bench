import { getGeminiModel } from './client';
import { CourtCaseSchema, CaseOutcomeSchema } from './schemas';
import type { CourtCase, CaseOutcome } from '../../types/game';


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
      "evidence": [{ "id": "string", "description": "string", "type": "string", "prosecution_argument": "string", "defense_argument": "string", "admissibility_status": "Pending" }],
      "witnesses": [{ "id": "string", "name": "string", "role": "string", "credibility_score": number, "key_testimony": "string" }],
      "game_state": { "current_stage": "Arraignment", "is_mistrial": false, "defense_attorney_aggression": number, "prosecutor_competence": number }
    }
    
    Ensure "admissibility_status" is always "Pending" for new evidence.
    Ensure "current_stage" is "Arraignment".
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

export const generateOutcome = async (apiKey: string, caseData: CourtCase, decision: string): Promise<CaseOutcome> => {
  const model = getGeminiModel(apiKey);

  const prompt = `
    You are an AI Judge Review Board.
    Review the following case and the player's (Judge's) decision.
    
    Case Data: ${JSON.stringify(caseData)}
    Judge's Decision: "${decision}"
    
    Generate an outcome object strictly adhering to this JSON schema:
    {
      "verdict": "string", // Final verdict on the case
      "sentence": "string", // If applicable, else empty string
      "rationale": "string", // Explanation of why the outcome occurred based on the decision
      "public_reaction": "string" // How the public/media reacts
    }
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  try {
    const json = JSON.parse(text);
    return CaseOutcomeSchema.parse(json) as CaseOutcome;
  } catch (error) {
    console.error("Failed to parse Gemini outcome:", text, error);
    throw new Error("Failed to generate a valid case outcome.");
  }
};
