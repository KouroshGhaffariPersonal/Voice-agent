// Make pc accessible in wider scope
let pc = null;
let transcriptDiv = null;

async function initializeAgent() {
  // Get reference to existing transcript div
  transcriptDiv = document.getElementById("transcript");

  // Animate title and button sequentially
  const title = document.querySelector("h1");
  const startButton = document.getElementById("start-session");

  // Set initial styles
  title.style.opacity = "0";
  startButton.style.opacity = "0";

  // Animate title first
  setTimeout(() => {
    title.classList.add("animate-title");
  }, 100);

  // Animate button 1 second after title animation
  setTimeout(() => {
    startButton.classList.add("animate-button");
  }, 1900);

  // Get agent ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get("id");

  if (!agentId) {
    console.error("No agent ID provided");
    document.body.innerHTML = "<h1>Error: Invalid agent link</h1>";
    return;
  }

  // Add click handler for start button
  document
    .getElementById("start-session")
    .addEventListener("click", async () => {
      try {
        // Show end button (already exists in HTML)
        const endButton = document.getElementById("end-session");
        endButton.style.display = "block";

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
          // Send initial configuration
          dc.send(
            JSON.stringify({
              type: "session.update",
              session: {
                input_audio_transcription: {
                  model: "whisper-1",
                },
              },
            })
          );
        };

        dc.addEventListener("message", (e) => {
          try {
            const messageData = JSON.parse(e.data);
            console.log("Message type:", messageData); // Debug log

            if (messageData.type === "session.created") {
              // dc.send(
              //   JSON.stringify({
              //     type: "conversation.item.create",
              //     item: {
              //       type: "message",
              //       role: "user",
              //       content: [
              //         {
              //           type: "input_text",
              //           text: "Hello, how are you?",
              //         },
              //       ],
              //     },
              //   })
              // );

              dc.send(
                JSON.stringify({
                  type: "response.create",
                  response: {
                    instructions: `Say hello and introduce yourself. Then start talking about the instructions you were given. These are your instructions ${agent.data.instructions}. Always respond in a conversational manner. Always keep your responses concise and to the point.`,
                  },
                })
              );
            }

            // Check for session.created event
            if (messageData.type === "session.created") {
              console.log("Session created with config:", messageData.config);
            }
            // Check for different types of transcripts
            else if (messageData.type === "response.audio_transcript.delta") {
              updateTranscript(messageData.delta, "assistant");
            } else if (messageData.type === "input.audio_transcript.delta") {
              updateTranscript(messageData.delta, "user");
            }
          } catch (error) {
            console.log("Raw message:", e.data);
            console.error("Error parsing message:", error);
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

        // Update end button display logic
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
function updateTranscript(newText, speaker) {
  if (!transcriptDiv) return;

  // Create or get the current paragraph for this speaker
  let currentParagraph = transcriptDiv.lastElementChild;
  if (!currentParagraph || currentParagraph.dataset.speaker !== speaker) {
    currentParagraph = document.createElement("p");
    currentParagraph.dataset.speaker = speaker;
    currentParagraph.style.marginBottom = "10px";
    currentParagraph.style.color =
      speaker === "assistant" ? "#2c5282" : "#2d3748";
    transcriptDiv.appendChild(currentParagraph);
  }

  // Append the new text
  currentParagraph.textContent += newText;

  // Auto-scroll to bottom
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

// Initialize when page loads
initializeAgent();
