const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
require('dotenv').config();

// Create the server
const server = http.createServer(app);

// Use CORS middleware
app.use(cors());

// Check the web URL environment variable
const webURL = process.env.WEB_URL_KEY || '*'; // Fallback to '*' for dev environments
console.log("Web URL from ENV:", webURL);

// Set up Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: webURL,  // Use the env variable or fallback
    methods: ["GET", "POST"],
  },
});

// Listen for client connection
io.on("connection", (socket) => {
  console.log("A user connected");

  // When a user joins a room
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  // When a message is sent to a room
  socket.on("message", (msgData) => {
    const { room } = msgData;
    io.to(room).emit("message", msgData); // Broadcast the message to the room
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// A simple test route to confirm the server is running
app.get("/", (req, res) => {
  res.send("Socket.IO server is running");
});

// Start the server with a dynamic port (for hosting) or fallback to port 4000
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
