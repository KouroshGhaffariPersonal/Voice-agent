const express = require("express");
const cors = require("cors");
require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "voicefeedback", // Separate database name for this application
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Agent Schema
const agentSchema = new mongoose.Schema({
  instructions: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Agent = mongoose.model("Agent", agentSchema);

//OPEN AI CONNECTION
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Voice Feedback API is running" });
});

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
// Update the session endpoint to accept POST and use the provided instructions
app.post("/session", async (req, res) => {
  const { instructions } = req.body;

  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview-2024-12-17",
      voice: "alloy",
      modalities: ["text", "audio"],
      input_audio_transcription: {
        model: "whisper-1",
      },
      instructions:
        `You are a researcher with the task of getting the user to talk about ${instructions}. You always start the conversation. You don't wait for voice input from the user to start talking.` ||
        "You are a user researcher for a product called Voice Feedback. You are interviewing a customer about their experience with the product. You don't wait for voice input from the user to start talking",
    }),
  });
  const data = await r.json();

  res.send(data);
});

// New endpoints for agent management
app.post("/create-agent", async (req, res) => {
  try {
    const { instructions } = req.body;
    if (!instructions) {
      return res.status(400).json({
        status: "error",
        message: "Instructions are required",
      });
    }

    const agent = new Agent({ instructions });
    await agent.save();

    res.status(201).json({
      status: "success",
      data: {
        id: agent._id,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      status: "error",
      message: "Error creating agent",
    });
  }
});

app.get("/agent/:id", async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        status: "error",
        message: "Agent not found",
      });
    }

    res.json({
      status: "success",
      data: {
        id: agent._id,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      status: "error",
      message: "Error retrieving agent",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
