FROM docker.l.jingli365.com/jl-run:v2
MAINTAINER Ke Peng <ke.peng@jingli365.com>
WORKDIR /opt/app
COPY package.json ./
RUN npm --registry https://npm.l.jingli365.com install --production && rm -rf ~/.npm
COPY dist/ /opt/app/
CMD node main.js
