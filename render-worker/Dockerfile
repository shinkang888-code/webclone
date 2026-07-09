FROM node:24-slim

RUN npx playwright install --with-deps chromium

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV PORT=3100
EXPOSE 3100

CMD ["npm", "start"]
