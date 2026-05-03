FROM node:10

WORKDIR /usr/src/app

COPY . .

EXPOSE 4200

RUN npm install

CMD ["npm", "start"]
