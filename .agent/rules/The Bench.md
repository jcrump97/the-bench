---
trigger: model_decision
description: This rule should be applied when planning tasks are being completed. This file includes the overall plan for the game and provides valuable context for the model to make important decisions. 
---

**The Bench**  
**Judge Simulation Game**  
\-----  
Summary

A Gemini API powered game hosted on GitHub Pages that allows the user to input their Gemini API key to then begin playing an AI powered game that immerses the user into the role of a county felony court judge. This app is powered by React and will be created using Antigravity IDE.

Game Flow

* The game starts the player out by introducing the basic concepts and interface elements for managing the court room and responding to motions.  
* The AI model will then generate the first docket case including the Plaintiff details, Defense details, narrative of facts, key evidence items, defendants prior history and background, and a list of witnesses for both sides.  
* The Case will then be presented within the main judicial interface. The defendant details will exist in one side panel while the plaintiff details will exist in another side panel. These side panels will be expandable and contractable. In the center of the main judicial interface exists the transcript. The transcript interface will be interactive, allowing the judge to quickly annotate or search testimony when ruling on motions.  
* Below the transcript will be the pending orders for review tray. Here is where orders or motions submitted by any attorney for review will appear for judicial review. When a pending order or motion is clicked, the AI model will generate a completion form including different elements allowing the judge (player) to quickly modify the order before signing or rejecting. The judge will also be required to rule on the admissibility of evidence during the trial or discovery phases, applying rules of evidence. The judge must also rule on whether the case proceeds as a bench trial or a jury trial, and manage the jury selection (voir dire) process, including sustaining or overruling attorney challenges. These orders can move the case forward to the next stage, conclude the case, prolong the case, or a number of things.  
* Orders have a chance to be appealed. If an appeal is triggered, an appeal AI judge will review the overall facts of the case and the judicial decision to determine if the motion should be overruled. The appeal AI will also generate a brief explanation *why* the decision was overruled, citing the legal precedent or error. A lower reputation will increase the frequency of attorney challenges and the rate of appeals being granted. Every time a decision is overruled, the player's reputation lowers and their score drops. Too many appeals within the same cause causes a mistrial.  
* The stages of a case: Arraignment/Bond \> Pre-Trial/Plea Hearing \> Discovery Hearing \> Jury Selection (if not bench trial) \> Trial \> Sentencing Hearing.  
* The game will handle one case at a time until either the reputation of the judge is zero or until the Resign button is pressed. Throughout the game, the AI will also introduce narrative events such as media scrutiny, attorney misconduct, and interactions with court staff. If the resign button is pressed, all cases played during the game session will be reviewed by an AI game scorer that will outline the long-term impact of the player's decisions (including social impact and reduction in repeat offenses) and the player's legal compliance. The score will be a detailed breakdown including metrics for Efficiency, Legal Compliance, Public Trust/Reputation, and Case Outcome Fairness.

Technical Note

* **API Key Validation:** The application will include a robust system to validate the input Gemini API key immediately upon entry, providing clear feedback if the key is invalid or lacks necessary permissions.

Case Data Schema

{  
  "case\_metadata": {  
    "docket\_number": "String (e.g., CR-2026-042)",  
    "charge\_level": "String (e.g., Felony Class B)",  
    "presiding\_judge\_reputation\_stake": "Integer (1-10, how much rep is at risk)"  
  },  
  "defendant": {  
    "name": "String",  
    "demographics": "String (e.g., 34yo Male, Machinist)",  
    "prior\_history": \[  
      "String (e.g., 2022 \- DUI \- Convicted)",  
      "String (e.g., 2024 \- Assault 3rd \- Dismissed)"  
    \],  
    "flight\_risk\_score": "Integer (1-10)",  
    "public\_trust\_impact": "String (High/Med/Low)"  
  },  
  "charges": \[  
    {  
      "code": "String (e.g., Ala. Code 13A-6-2)",  
      "description": "String",  
      "min\_sentence\_months": "Integer",  
      "max\_sentence\_months": "Integer"  
    }  
  \],  
  "evidence": \[  
    {  
      "id": "E-001",  
      "description": "String (e.g., Dashcam footage timestamped 22:00)",  
      "type": "String (Physical/Testimonial/Documentary)",  
      "prosecution\_argument": "String",  
      "defense\_argument": "String",  
      "admissibility\_status": "String (Pending/Admitted/Suppressed)"  
    }  
  \],  
  "witnesses": \[  
    {  
      "id": "W-01",  
      "name": "String",  
      "role": "String (e.g., Arresting Officer)",  
      "credibility\_score": "Integer (1-10 hidden value for game logic)",  
      "key\_testimony": "String (Summary of what they saw)"  
    }  
  \],  
  "game\_state": {  
    "current\_stage": "String (Arraignment)",  
    "is\_mistrial": false,  
    "defense\_attorney\_aggression": "Integer (1-10)",  
    "prosecutor\_competence": "Integer (1-10)"  
  }  
}

Tech Stack 

1\. Core Framework: React (Vite) \+ TypeScript  
Why: TypeScript is non-negotiable for AI-assisted coding. It provides the "guardrails" that prevent the AI from hallucinating variables that don't exist.  
Build Tool: Vite (fast, lightweight, optimizes for static hosting).  
2\. UI System: Tailwind CSS \+ shadcn/ui  
Why: shadcn/ui is the "agent-native" choice. It copies component code directly into your /src folder. This allows the AI to customize components deeply without fighting a black-box library. Tailwind allows for rapid styling without writing separate CSS files that confuse the context window.  
3\. State Management: Zustand  
Why: We need to track complex game state (Case Evidence, Player Reputation, Transcript History). Redux is too heavy; Context is too slow. Zustand allows us to create a global useGameStore that the AI can easily reason about and update (e.g., decreaseReputation(5)).  
4\. AI Integration: Google Generative AI SDK (Web)  
Why: We will use the client-side SDK. This allows the user to input their own API key in the browser, which is stored in localStorage.  
Cost Control Strategy: We will not send the full history every time. We will use a "sliding window" context or summarize previous turns into the CaseObject to keep input tokens low.  
5\. Hosting & Deployment: GitHub Pages  
Why: Free hosting. We will use a GitHub Action to automatically build and deploy the React app whenever we push to the main branch.  
6\. Formatting & Quality Control  
ESLint \+ Prettier: Enforces code style so the AI doesn't write messy code.  
Zod: Used for runtime validation of the JSON structured outputs from Gemini. (If the AI generates a case with a missing field, Zod catches it before the app crashes).