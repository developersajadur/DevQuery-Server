const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
require('dotenv').config();
const server = http.createServer(app);

app.use(cors());

// console.log("Web URL from ENV:", process.env.WEB_URL_KEY); 

const io = new Server(server, {
  cors: {
    origin: process.env.WEB_URL_KEY,
    // origin: process.env.WEB_URL_KEY,
    methods: ["GET", "POST"],
    credentials: true, 
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

// Start the server
server.listen(4000, () => {
  console.log("Server is running on port 4000");
});
