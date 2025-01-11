// Make pc accessible in wider scope
let pc = null;
let transcriptDiv = null;

async function initializeAgent() {
  // Get agent ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get("id");

  if (!agentId) {
    console.error("No agent ID provided");
    document.body.innerHTML = "<h1>Error: Invalid agent link</h1>";
    return;
  }

  // Create transcript div at the start
  transcriptDiv = document.createElement("div");
  transcriptDiv.id = "transcript";
  transcriptDiv.style.cssText = `
    margin-top: 20px;
    padding: 15px;
    border: 1px solid #ccc;
    border-radius: 5px;
    min-height: 100px;
    max-height: 300px;
    overflow-y: auto;
  `;
  document.getElementById("start-session").after(transcriptDiv);

  // Add click handler for start button
  document
    .getElementById("start-session")
    .addEventListener("click", async () => {
      try {
        // Create end conversation button
        const endButton = document.createElement("button");
        endButton.id = "end-session";
        endButton.textContent = "End Conversation";
        endButton.style.display = "none"; // Hide initially
        document.getElementById("start-session").after(endButton);

        // First fetch the agent's instructions
        const agentResponse = await fetch(
          `https://voice-feedback-api-7329c580eca3.herokuapp.com/agent/${agentId}`
        );
        const agent = await agentResponse.json();

        console.log("Agent data:", agent); // Debug log

        // Get session token with the stored instructions
        const sessionResponse = await fetch(
          "https://voice-feedback-api-7329c580eca3.herokuapp.com/session",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              instructions: agent.data.instructions, // Make sure we're accessing the correct path
            }),
          }
        );

        const data = await sessionResponse.json();
        const EPHEMERAL_KEY = data.client_secret.value;

        // Create peer connection
        pc = new RTCPeerConnection();

        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        pc.ontrack = (e) => (audioEl.srcObject = e.streams[0]);

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        pc.addTrack(ms.getTracks()[0]);

        const dc = pc.createDataChannel("oai-events");

        // Set up data channel for events
        dc.onopen = () => {
          // Send initial instructions once connected
          dc.send(
            JSON.stringify({
              type: "config",
              data: {
                metadata: {
                  speaker: "assistant",
                  system_message: agent.data.instructions,
                },
              },
            })
          );
        };

        dc.addEventListener("message", (e) => {
          try {
            // Parse the message data
            const messageData = JSON.parse(e.data);

            // Check if it's a transcript delta
            if (messageData.type === "response.audio_transcript.delta") {
              // Add the new text to the transcript
              updateTranscript(messageData.delta);
            }

            console.log("Message received:", messageData);
          } catch (error) {
            console.log("Non-JSON message received:", e);
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-mini-realtime-preview-2024-12-17";
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
        });

        const answer = {
          type: "answer",
          sdp: await sdpResponse.text(),
        };
        await pc.setRemoteDescription(answer);

        // Show end button once connection is established
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            endButton.style.display = "block";
          }
        };

        // Add click handler for end button
        endButton.addEventListener("click", () => {
          if (pc) {
            pc.close();
            pc = null;
          }
          endButton.style.display = "none";
          document.getElementById("start-session").style.display = "block";

          // Clear the transcript
          if (transcriptDiv) {
            transcriptDiv.textContent = "";
          }
        });
      } catch (error) {
        console.error("Error:", error);
        document.body.innerHTML =
          "<h1>Error: Could not start conversation</h1>";
      }
    });
}

// Function to update the transcript
function updateTranscript(newText) {
  if (!transcriptDiv) return;

  // Append the new text
  transcriptDiv.textContent += newText;

  // Auto-scroll to bottom
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

// Initialize when page loads
initializeAgent();
