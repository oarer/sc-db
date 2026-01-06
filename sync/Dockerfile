FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo/src

COPY ../package.json ../bun.lock ./
RUN bun install

COPY . ./

CMD ["bun", "index.ts"]
