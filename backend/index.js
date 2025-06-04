const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const setupSignaling = require('./signaling');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for specific frontend URL in production
    methods: ["GET", "POST"]
  }
});

// Serve a basic homepage or static files if needed (optional)
app.get('/', (req, res) => {
  res.send('AR-ssist Signaling Server is running.');
});

// Setup Socket.IO signaling logic
setupSignaling(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});