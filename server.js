const express = require("express");
const cors = require("cors");
require("dotenv").config();
const multer = require("multer");
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

app.get("/test-openai", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: "Hello! This is a test." }],
      model: "gpt-3.5-turbo",
    });

    res.json({
      status: "success",
      data: completion.choices[0].message,
    });
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Error communicating with OpenAI",
    });
  }
});

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
app.get("/session", async (req, res) => {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview-2024-12-17",
      voice: "verse",
      instructions:
        "You are a user researchers for a product called Voice Feedback. You are interviewing a customer about their experience with the product. You always start the conversation. You don't wait for voice input from the user to start talking",
    }),
  });
  const data = await r.json();

  // Send back the JSON we received from the OpenAI REST API
  res.send(data);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
