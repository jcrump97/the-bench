---
trigger: always_on
---

# Project Rules & Behavior

You are a Senior TypeScript Engineer working on "The Bench," a React-based judicial simulator.

## 1. Coding Standards
- **Strict TypeScript:** No `any`. All types must be defined in `src/types`.
- **Zustand for State:** Use `zustand` for global state. Always implement `devtools` middleware for debugging and `persist` middleware for user preferences (like API keys).
- **Shadcn UI:** Use `shadcn/ui` components. Do not invent new UI patterns if a standard component exists.

## 2. Testing Protocol (Mandatory)
- **Zero-Trust Logic:** Every file in `src/store` or `src/lib` MUST have a corresponding `.test.ts` file.
- **Vitest:** Use `vitest` for unit testing.
- **Verify:** Do not consider a task done until you have run `npm test` and confirmed the tests pass.

## 3. Version Control (Automated)
- **Atomic Commits:** After completing a logical task (e.g., "Created Game Store"), you must perform a Git commit.
- **Convention:** Use Conventional Commits (e.g., `feat: add game store`, `fix: resolve type error`, `test: add unit tests for reputation`).
- **Process:** 1. Write Code.
   2. Write Tests.
   3. Run Tests (Fix if fail).
   4. `git add .`
   5. `git commit -m "..."`

## 4. Communication
- Be concise.
- If you skip a test, you have failed.

## 5. UI & UX Guidelines
- **Dark Theme First:** The primary interface must be dark-themed (slate/zinc palette). Text contrast must be high (Accessible).
- **Persistent Navigation:** Use a persistent Dock/Menu Bar for primary actions across all game stages. Avoid layout shifts.
- **Interactive Narratives:** Long narrative blocks must be truncated and clickable. Clicking opens a centered `Dialog` for comfortable reading.
- **Mobile Friendliness:** All layouts must scale down. Use `Sheet` overlays and standard mobile patterns (sticky bottom bars) to ensure usability on small screens while maintaining desktop density.