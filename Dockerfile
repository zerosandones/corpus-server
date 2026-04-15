FROM docker.io/oven/bun:1 AS builder

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun build ./src/server.ts --target bun --outdir ./dist


FROM docker.io/oven/bun:1-distroless

WORKDIR /app
COPY --from=builder /app/dist ./bin
EXPOSE 8080
CMD ["./bin/server.js"]
