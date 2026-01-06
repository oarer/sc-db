FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN git config --global user.name "StalHub.bot" \
 && git config --global user.email "stalhub.dev@gmail.com"

WORKDIR /repo

COPY package.json bun.lock ./
RUN bun install

COPY src ./src

WORKDIR /repo/src
CMD ["bun", "run", "index.ts"]
