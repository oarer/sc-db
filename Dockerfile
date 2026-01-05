FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install

VOLUME ["/app/items", "/app/merged"]

WORKDIR /app/src
CMD ["bun", "run", "index.ts"]
