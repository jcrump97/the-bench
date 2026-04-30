# The Bench ⚖️

AI-powered judicial simulation game. Step into the robe of a county felony court judge, review AI-generated felony cases, rule on bond at arraignment, oversee the trial, and render verdict — all while managing your reputation on the bench.

[Play The Bench →](https://jcrump97.github.io/the-bench/)

## What It Is

The Bench is a browser-based game where you act as a **County Court Judge**. Gemini AI generates realistic felony cases complete with defendants, evidence, witnesses, and charges. You manage each case through multiple stages — arraignment, pre-trial, trial, and sentencing — making rulings that affect your judicial reputation.

**Key decisions you make:**
- Set bond type and amount at arraignment
- Rule on evidence admissibility during trial
- Respond to motions from prosecution and defense
- Render final verdict and sentence
- Survive appeals that test the soundness of your rulings

Wrong calls damage your reputation. Accumulate too many, and your career ends.

## How to Play

1. **Get a Gemini API Key** (free at [aistudio.google.com](https://aistudio.google.com)) — or try **Demo Mode** below
2. **Enter your key** in the API Key form or click **Play Demo**
3. **Call to Order** — Gemini generates a felony case
4. **Arraignment** — Review the defendant profile, charges, and evidence
5. **Set Bond** — Choose bond type (ROR, Cash, Surety) and conditions
6. **Trial Dashboard** — Watch evidence, review motions, manage the courtroom
7. **Call for Verdict** — When ready, render final judgement
8. **Review Outcome** — See how the public reacted, your reputation shift, and session score
9. **Adjudicate Next Case** — Rinse and repeat

Every case is procedurally generated. No two dockets are alike.

## Demo Mode

No API key? No problem. Click **Play Demo** on the start screen to play with pre-generated static cases. Demo mode skips the Gemini API entirely — all case data is hardcoded.

## Tech Stack

- **React 18** + **TypeScript 5** + **Vite 5**
- **Tailwind CSS 3** + **shadcn/ui** (Radix primitives)
- **Zustand** state management (persisted to localStorage)
- **Zod** runtime schema validation for AI responses
- **Google Generative AI SDK** (client-side, user-provided API key)
- **GitHub Pages** hosting

## Getting Started

```bash
git clone https://github.com/jcrump97/the-bench.git
cd the-bench
npm install
npm run dev          # localhost:5173
npm run build        # production dist/
npm run preview      # preview dist on localhost:4173
```

## Configuration

The app requires a **Google Gemini API key**. You can get one free at:
- [Google AI Studio](https://aistudio.google.com) — create key → copy → paste in-game

The key is stored in **your browser's localStorage** — it never leaves your machine.

## Project Config

Default OpenCode model (project-level): `ollama-cloud/glm-5.1`

```bash
# Run tasks with the project agent
cd ~/repos/jcrump97-the-bench
oc run "Your task here" --model ollama-cloud/glm-5.1
```

## License

[MIT License](./LICENSE) © 2026 Jonathan Crump

## Roadmap

- [x] Core case generation via Gemini
- [x] Arraignment with bond setting
- [x] Trial dashboard with resizable panels
- [x] Reputation scoring
- [x] Demo mode (no API key needed)
- [x] Mobile-responsive layout
- [ ] Evidence admissibility rulings during trial
- [ ] Jury vs bench trial selection
- [ ] Motion review and signing
- [ ] Appeals system
- [ ] Session summary scoring
- [ ] Leaderboard / case history browser
- [ ] Dark mode

---

Built with 💻, 🧠, and an unhealthy familiarity with *Law & Order* reruns.
