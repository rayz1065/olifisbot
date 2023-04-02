FROM node:19

WORKDIR /usr/src/app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install

COPY .env .env
COPY prisma prisma

RUN npx prisma generate

COPY . .
RUN yarn build
