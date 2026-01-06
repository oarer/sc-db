FROM oven/bun:latest

WORKDIR /repo

COPY package.json bun.lock ./
RUN bun install

COPY src ./src

WORKDIR /repo/src
CMD ["bun", "run", "index.ts"]
