const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://devquery-by-webcrafters.vercel.app",
    "https://devquery-by-webcrafters.vercel.app/chat",
    process.env.WEB_URL_KEY,
  ],
  methods: ["GET", "POST"],
  credentials: true,
}));

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://devquery-by-webcrafters.vercel.app",
      "https://devquery-by-webcrafters.vercel.app/chat",
      process.env.WEB_URL_KEY,
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function startServer() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB!");

    // Define the participants collection here
    const participantsCollection = client.db("Dev-Query").collection("participants");

    // Listen for client connection
    io.on("connection", (socket) => {
      console.log("A user connected");

      // Handle joining a room
      socket.on("joinRoom", (room) => {
        if (room) {
          socket.join(room);
          // console.log(`User joined room: ${room}`);
        }
      });

      // Handle receiving a message
      socket.on("message", async (msgData) => {
        const { room, userId, participantId } = msgData;

        if (room) {
          // Broadcast the message to all users in the room
          io.to(room).emit("message", msgData);
          // console.log(`Message sent to room ${room}:`, msgData);

          // Store participants or other related data in MongoDB
          try {
            // Check if the participant already exists for the user
            const existingParticipant = await participantsCollection.findOne({
              userId: userId,
              "participants.participantsId": participantId
            });

            if (!existingParticipant) {
              // Add the participant to the user's participants list
              await participantsCollection.updateOne(
                { userId: userId },
                { $push: { participants: { participantsId: participantId } } },
                { upsert: true }
              );
              // console.log(`Participant ${participantId} added for user ${userId}`);
            }
          } catch (error) {
            console.error("Error storing participant data", error);
          }
        }
      });

      // Handle user disconnection
      socket.on("disconnect", () => {
        console.log("A user disconnected");
      });
    });

    // Test route
    app.get("/", (req, res) => {
      res.send("Socket.IO server is running");
    });

    // Start the server
    server.listen(4000, () => {
      console.log("Server is running on port 4000");
    });

  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

startServer();
