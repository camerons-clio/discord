# Setup Image
FROM node:20.10.0-slim
ARG USER=default
ARG UID=1001
ARG GID=1001
ENV NODE_ENV=production

# Update Container
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g npm@latest

# Create User
RUN groupadd -g $GID $USER && \
    useradd -m -u $UID -g $GID -s /bin/bash $USER

# Create App Directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy App
COPY . /usr/src/app

# Set Permissions and Install app
RUN chown -R $USER:$USER /usr/src/app
RUN npm install --omit=dev

# Run App
USER $USER
CMD ["npm", "run", "start"]