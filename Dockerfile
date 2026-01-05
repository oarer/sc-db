FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install

VOLUME ["/app/items", "/app/merged"]

CMD ["bun", "run", "index.ts"]
