FROM oven/bun:latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates openssh-client \
 && rm -rf /var/lib/apt/lists/*

RUN git config --global user.name "StalHub.bot" \
 && git config --global user.email "stalhub.dev@gmail.com" 

RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY src ./src

CMD ["bun", "run", "src/index.ts"]
