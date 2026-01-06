FROM oven/bun:latest

WORKDIR /app

COPY bun.lock package.json ./
RUN bun install

COPY src ./src

RUN mkdir -p /app/items /app/merged

WORKDIR /app/src
CMD ["bun", "run", "index.ts"]