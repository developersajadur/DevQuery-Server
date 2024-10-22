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

    const participantsCollection = client.db("Dev-Query").collection("participants");

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
        const { room, userEmail, participantEmail, text, time } = msgData;

        if (room && userEmail && participantEmail && text) {
          // Store the message in MongoDB
          try {
            const existingParticipant = await participantsCollection.findOne({
              userEmail: userEmail,
              "participants.participantsId": participantEmail,
            });

            if (existingParticipant) {
              await participantsCollection.updateOne(
                {
                  userEmail: userEmail,
                  "participants.participantsId": participantEmail,
                },
                {
                  $push: {
                    "participants.$.messages": {
                      sender: userEmail,
                      receiver: participantEmail,
                      text: text,
                      time: time || new Date(),
                    },
                  },
                }
              );
              console.log(`Message stored for participant ${participantEmail}`);
            } else {
              await participantsCollection.updateOne(
                { userEmail: userEmail },
                {
                  $push: {
                    participants: {
                      participantsId: participantEmail,
                      messages: [
                        {
                          sender: userEmail,
                          receiver: participantEmail,
                          text: text,
                          time: time || new Date(),
                        },
                      ],
                    },
                  },
                },
                { upsert: true }
              );
              console.log(`Participant ${participantEmail} added for user ${userEmail} with the first message`);
            }

            // Broadcast the message to all users in the room
            io.to(room).emit("message", msgData);
            console.log(`Message sent to room ${room} by user ${userEmail}`);
          } catch (error) {
            console.error("Error storing participant data:", error);
          }
        } else {
          console.error("Invalid message data:", msgData);
        }
      });

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
    server.listen(process.env.PORT || 4000, () => {
      console.log(`Server is running on port ${process.env.PORT || 4000}`);
    });
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if unable to connect to MongoDB
  }
}

startServer();
