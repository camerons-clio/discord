# -------------
# -- Builder --
# -------------
# Compile the TS into JS
FROM node:20-alpine3.18 as builder

# Copy files and build app
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# ---------
# -- App --
# ---------
# Shove the JS into an actual image with lest privileges
FROM node:20-alpine3.18
ARG USER=default
ARG UID=1001
ARG GID=1001

# Update Container and NPM
RUN apk update && \
    apk upgrade
RUN npm install -g npm@latest

# Add Default
RUN addgroup -g $GID $USER && \
    adduser --disabled-password -D -u $UID -G $USER $USER

# Copy and set all perms to default
WORKDIR /usr/src/app

COPY package*.json ./

COPY --from=builder /usr/src/app/dist/ ./
RUN chown -R $USER:$USER /usr/src/app

# Switch to default
USER $USER

# Install prod deps
RUN npm ci --omit=dev

# Expose and run
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD nc -z localhost 3000 || exit 1
CMD [ "npm", "start", "--prefix", "/usr/src/app"]