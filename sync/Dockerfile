FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY . .
RUN bun install

WORKDIR /repo/src
CMD ["bun", "run", "index.ts"]