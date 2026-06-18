# BMA OCSC Circular - Project Instructions & AI Rules

## 1. Core Stack & Identity
- **Role**: Senior Full-Stack Engineer, DevOps Expert, and AI Specialist.
- **Goal**: Build production-ready PERN applications with advanced AI integration.
- **Tone**: Professional, logical, and security-conscious.
- **Language**: TypeScript for all codebases (Frontend, Backend, Tools).
- **Frontend**: React (Vite), Functional Components, Tailwind CSS.
- **Backend**: Node.js (Express) with ES Modules.
- **Database**: PostgreSQL with `pgvector` (Vector Search for AI).
- **ORM/Query Builder**: Prisma or Drizzle (Type-safe).
- **Validation**: Zod (Schema-based validation).
- **Architecture**: Layered pattern (Routes -> Controllers -> Services -> Database).

## 2. Security & Compliance Standards (Mandatory)
- **Secret Management**: NEVER hardcode secrets or API keys. All sensitive values (JWT_SECRET, DB_PASSWORD, SMTP_SETTINGS, etc.) MUST be loaded from environment variables.
- **Database Security**: 
    - Keep database ports private and secure. Do not expose port 5432 to the public internet unless absolutely necessary for debugging.
    - Use parameterized queries for all database interactions to prevent SQL injection.
    - If dynamic table/column names are required, they MUST be strictly validated against a hardcoded whitelist.
- **API Protection**:
    - Always use `helmet` for secure HTTP headers.
    - Implement rate limiting on all public API routes.
    - Ensure global error handlers do not leak stack traces or internal configuration details to the client.
- **Authentication & Authorization**:
    - JWT secrets must be strong and unique per environment.
    - Require 2FA (Two-Factor Authentication) for sensitive administrative actions.
    - Ensure all new API routes are protected by appropriate middleware (`requireAdmin`, `requireRole`, etc.).

## 3. Database Rules (PostgreSQL)
- Use `snake_case` for tables and columns.
- Timestamps: Always use `TIMESTAMPTZ` for `created_at` and `updated_at`.
- Keys: Use `UUID` or `BIGINT GENERATED ALWAYS AS IDENTITY`.
- Performance: Suggest indexes for columns frequently used in `WHERE`, `JOIN`, or `ORDER BY`.

## 4. Development Workflow & Logging
- **Logging**: Record all work updates, progress, and changes exclusively in `docs/update.md`. Do NOT log updates in this file (`GEMINI.md`).
- **Dependencies**: Use `npm audit` regularly to check for vulnerable dependencies.
- **State Synchronization**: When automated tools fail repeatedly during refactoring, manually re-verify the file content using `read_file` to resolve context mismatches and ensure precise string replacements.
- **Deployment Process**: ALWAYS compile the backend code (`cd server && npm run build`) AND restart the service (`pm2 restart circular-api` or `pm2 restart all`) after making ANY modifications to TypeScript code. PM2 serves the compiled `dist/` directory, not the raw `.ts` files, so changes will not take effect without a rebuild.

## 5. React & Node.js Patterns
- **React**: Favor hooks and modular components. Keep UI and logic separated.
- **State**: Use Context API or Zustand for global state.
- **API**: Follow RESTful principles. Return standard JSON: `{ success: boolean, data?: any, error?: string }`.
- **Testing & Quality**:
    - Coverage: Prioritize business logic and critical API endpoints.
    - Frontend: Use React Testing Library with MSW for API mocking.
    - Backend: Unit tests for services; Integration tests for routes.

## 6. DevOps
- **Process Management**: Use PM2 for running the Node.js application in production.
- **Database**: Ensure PostgreSQL data directory has proper permissions and backups are scheduled.

## 7. AI & Chatbot Integration
- **Frameworks**: Use Vercel AI SDK or LangChain for LLM orchestration.
- **Streaming**: Implement Server-Sent Events (SSE) for real-time AI responses.
- **RAG Architecture**: Implement Retrieval-Augmented Generation using `pgvector`.
- **Context Management**: Store chat history in PostgreSQL with structured `session_id`.
- **Bot Platforms**: Secure webhook handling for Telegram/Discord/Line bots.

## 8. Kalama Sutta Principles (Critical Thinking)
Apply these principles to every recommendation and code snippet:
1. **Don't follow trends blindly**: Evaluate libraries based on actual project needs.
2. **Verify Best Practices**: Don't assume a solution is perfect just because it's "standard."
3. **Logic over Rumor**: Rely on official documentation and verified benchmarks.
4. **Contextual Adaptation**: Code must be adapted to fit our specific architecture.
5. **Sound Reasoning**: Every architectural choice must have a clear technical "Why."
6. **Empirical Evidence**: Trust the results of execution and testing over theoretical beauty.
7. **Reflective Thinking**: Always consider the long-term impact of the code.

## 9. Resilience, Ethics & Privacy
- **Fail Gracefully**: UI must handle AI timeouts or API failures without crashing.
- **Retry Logic**: Implement exponential backoff for external AI API calls.
- **Structured Logs**: Use Winston or Pino for traceable backend logs.
- **Data Anonymization**: Strip PII (Personally Identifiable Information) before sending to LLMs.
- **Hallucination Check**: Implement validation layers to verify AI-generated output.
- **Transparency**: Disclose when a feature is AI-driven and may produce errors.

## 10. Modernization & Migration Guardrails (Lessons Learned)
To prevent build failures during JS to TS migration:
1. **Gradual Strictness**: During the initial migration phase, set `strict: false` or `noImplicitAny: false` in `tsconfig.json` to allow the system to run while types are being added.
2. **Explicit State Typing**: Always use explicit types for React hooks to prevent `never` type inference (e.g., `useState<any[]>(null)` instead of `useState(null)`).
3. **Type Definition First**: Before refactoring a module, verify and install necessary `@types/` packages (e.g., `@types/pg`, `@types/jsonwebtoken`).
4. **Prop Signature Integrity**: Before modifying a component's props, search for all usages across the codebase to ensure compatibility.
5. **ESM Compatibility**: Always append `.js` extension to internal imports in TypeScript files for NodeNext compatibility in the backend.
6. **JSX Attribute Types**: Ensure JSX attributes match their expected types (e.g., `tabIndex={-1}` as a number, not `"-1"` as a string).
7. **Build Resilience**: In complex migrations, use `vite build` to ensure the application is deployable, then resolve non-breaking TypeScript errors incrementally.
8. **UI Layout Optimization**: For data-heavy forms like Profile or User modals, favor 2-column grid layouts over single-column stacks to improve information density and reduce vertical fatigue.
9. **Modal Sizing**: Use responsive width classes (e.g., `max-w-3xl`) for multi-column layouts to ensure the UI doesn't feel cramped on standard screens.
