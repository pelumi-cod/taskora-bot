# Use Linux with Node.js pre-installed
FROM node:18-slim

# Install Google Chrome and dependencies required by Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set project working directory
WORKDIR /usr/src/app

# Copy dependency files and install them
COPY package*.json ./
RUN npm install

# Copy all project code
COPY . .

# Start the bot
CMD ["node", "bot.js"]