FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

ENV TOKEN_SERVER_PORT=4000
ENV TOKEN_SERVER_HOST=0.0.0.0
ENV LIVEKIT_API_KEY=devkey
ENV LIVEKIT_API_SECRET=secret
ENV LIVEKIT_WS_URL=ws://livekit:7880

CMD ["npx", "tsx", "src/index.ts"]
