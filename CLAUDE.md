# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations (first-time setup)
npm run dev          # Development server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run db:reset     # Reset database to initial state
```

Environment: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without it, the app uses a `MockLanguageModel` that generates sample components.

## Architecture

UIGen is a Next.js 15 app that lets users describe React components in chat, then generates and live-previews the code via Claude.

### Core Data Flow

1. User types a prompt in the chat panel (`src/components/chat/`)
2. Request hits `/api/chat` (route handler using Vercel AI SDK `streamText`)
3. Claude responds with tool calls: `str_replace_editor` and `file_manager` mutate a virtual file system
4. The virtual FS state propagates via `FileSystemContext` to the preview iframe
5. `jsx-transformer.ts` compiles JSX in-browser using Babel standalone + import maps
6. For authenticated users, projects are persisted to SQLite via Prisma

### Key Modules

- **`src/lib/file-system.ts`** — In-memory virtual FS (create/read/update, no disk writes). The entire project state lives here during a session.
- **`src/lib/provider.ts`** — Selects `anthropic('claude-sonnet-4-5')` or `MockLanguageModel` based on whether `ANTHROPIC_API_KEY` is set.
- **`src/lib/tools/`** — AI tool implementations: `str-replace.ts` for targeted edits, `file-manager.ts` for create/delete operations.
- **`src/lib/transform/jsx-transformer.ts`** — Transforms component code for iframe rendering with dynamic import maps.
- **`src/lib/prompts/generation.tsx`** — System prompt sent to Claude, with Anthropic ephemeral cache control for efficiency.
- **`src/lib/contexts/`** — `FileSystemContext` and `ChatContext` bridge server state to React components.
- **`src/middleware.ts`** — JWT auth middleware; protects `/[projectId]` routes.

### UI Layout

`main-content.tsx` renders two resizable panels:
- **Left (35%)**: Chat interface
- **Right (65%)**: Tabs for Preview (iframe) and Code (Monaco editor + file tree)

### Auth

JWT sessions (7-day expiry) stored in HTTP-only cookies. Bcrypt password hashing. Server actions in `src/actions/` handle sign-up/sign-in/sign-out. Anonymous users can use the app but projects aren't persisted.

### Database

SQLite via Prisma. Schema: `User` (email + hashed password) and `Project` (userId, messages JSON, file system data JSON). Generated client outputs to `src/generated/prisma`.

## Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`).
