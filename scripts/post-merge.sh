#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Build all shared lib packages in dependency order
pnpm --filter @workspace/db run build
pnpm --filter @workspace/api-zod run build
pnpm --filter @workspace/api-client-react run build
pnpm --filter @workspace/integrations-openai-ai-server run build
pnpm --filter @workspace/integrations-openai-ai-react run build

# Run database migrations
pnpm --filter @workspace/db run push
