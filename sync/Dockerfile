FROM oven/bun:latest

WORKDIR /repo

COPY bun.lock package.json ./
RUN bun install

COPY src ./src

WORKDIR /repo/src
CMD ["bun", "run", "index.ts"]
