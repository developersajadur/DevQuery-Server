const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const server = http.createServer(app);

// Environment variable check
if (!process.env.MONGODB_URI) {
  console.error("MongoDB URI is not set in environment variables.");
  process.exit(1);
}

// Enable CORS with better security
const allowedOrigins = [
  "http://localhost:3000",
  "https://devquery-by-webcrafters.vercel.app",
  "https://devquery-by-webcrafters.vercel.app/chat",
  process.env.WEB_URL_KEY,
];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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
    const participantsCollection = client
      .db("Dev-Query")
      .collection("participants");

    // Listen for client connection
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // Handle joining a room
      socket.on("joinRoom", (room) => {
        if (room && typeof room === "string") {
          socket.join(room);
          console.log(`User ${socket.id} joined room: ${room}`);
        } else {
          console.error("Invalid room name:", room);
        }
      });

      // Handle receiving a message
      socket.on("message", async (msgData) => {
        const { room, userId, participantId, text, time } = msgData;

        if (room && userId && participantId && text) {
          // Broadcast the message to all users in the room
          io.to(room).emit("message", msgData);
          console.log(`Message sent to room ${room} by user ${userId}`);

          // Store the message data in MongoDB
          try {
            const existingParticipant = await participantsCollection.findOne({
              userId: userId,
              "participants.participantsId": participantId,
            });

            if (existingParticipant) {
              // Add the message to the participant's message array
              await participantsCollection.updateOne(
                {
                  userId: userId,
                  "participants.participantsId": participantId,
                },
                {
                  $push: {
                    "participants.$.messages": {
                      sender: userId,
                      receiver: participantId,
                      text: text,
                      time: time || new Date(),
                    },
                  },
                }
              );
              console.log(`Message stored for participant ${participantId}`);
            } else {
              // Add the participant and the first message if they don't exist
              await participantsCollection.updateOne(
                { userId: userId },
                {
                  $push: {
                    participants: {
                      participantsId: participantId,
                      messages: [
                        {
                          sender: userId,
                          receiver: participantId,
                          text: text,
                          time: time || new Date(),
                        },
                      ],
                    },
                  },
                },
                { upsert: true }
              );
              console.log(`Participant ${participantId} added for user ${userId} with the first message`);
            }
          } catch (error) {
            console.error("Error storing participant data:", error);
          }
        } else {
          console.error("Invalid message data:", msgData);
        }
      });

      app.get("/participants", async (req, res) => {
        try {
          const participants = await participantsCollection.find({}).toArray();
          res.send(participants);
        } catch (error) {
          console.error("Error fetching participants data:", error);
          res.status(500).send("Error fetching participants data");
        }
      })

      // Handle user disconnection
      socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
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
    process.exit(1); // Exit the process if unable to connect to MongoDB
  }
}

startServer();
