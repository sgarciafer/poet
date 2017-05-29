FROM node:latest

RUN mkdir -p /poet-js

# We're picking up the poet-js library from the host machine and using npm link
# to allow local development and testing of the library.

# docker-compose looks for .dockerignore files only in the root of the context,
# so we need to manually COPY each file/folder instead of COPYing the entire poet-js directory
COPY ./poet-js/package.json /poet-js
COPY ./poet-js/tsconfig.json /poet-js
COPY ./poet-js/src /poet-js/src

WORKDIR /poet-js
RUN npm i -g typescript
RUN npm install > /dev/null
RUN npm run build
RUN npm link

RUN mkdir -p /web
WORKDIR /web

COPY ./poet/web/package.json /web
COPY ./poet/web/tsconfig.json /web
COPY ./poet/web/webpack.config.js /web
COPY ./poet/web/devServer.js /web

# Workaround for https://github.com/npm/npm/issues/9863
RUN cd $(npm root -g)/npm \
  && npm install fs-extra \
  && sed -i -e s/graceful-fs/fs-extra/ -e s/fs\.rename/fs.move/ ./lib/utils/rename.js

RUN npm link poet-js
RUN npm install > /dev/null

CMD [ "npm", "start" ]