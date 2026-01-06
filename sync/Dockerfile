FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY package.json bun.lock ./
RUN bun install

COPY src ./src
COPY .git .git

WORKDIR /repo
CMD ["sh", "-c", "while true; do bun run src/index.ts || true; sleep 5; done"]
