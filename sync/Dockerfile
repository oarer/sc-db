FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY bun.lock package.json ./
RUN bun install

COPY src ./src

WORKDIR /repo/src
CMD ["bun", "run", "index.ts"]
