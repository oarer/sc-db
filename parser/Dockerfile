FROM oven/bun:latest

WORKDIR /app

COPY bun.lockb package.json ./
RUN bun install

# код
COPY src ./src

RUN mkdir -p /data/items /data/merged

WORKDIR /app/src
CMD ["bun", "run", "index.ts"]
