FROM oven/bun:latest

WORKDIR /repo

COPY bun.lock package.json ./
RUN bun install

COPY src ./src

CMD ["bun", "run", "src/index.ts"]
