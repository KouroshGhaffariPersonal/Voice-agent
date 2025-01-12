// Make pc accessible in wider scope
let pc = null;
let transcriptDiv = null;
let currentMessage = null;
let currentConversationId = null;

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
      // Clear previous transcript when starting new conversation
      if (transcriptDiv) {
        transcriptDiv.textContent = "";
      }

      try {
        const startButton = document.getElementById("start-session");
        const endButton = document.getElementById("end-session");
        const spinner = document.getElementById("loading-spinner");

        // Hide start button and show spinner
        startButton.style.display = "none";
        spinner.style.display = "block";

        // First fetch the agent's instructions
        const agentResponse = await fetch(
          `https://voice-feedback-api-7329c580eca3.herokuapp.com/agent/${agentId}`
        );
        const agent = await agentResponse.json();

        console.log("Agent data:", agent); // Debug log

        // Create new conversation
        const conversationResponse = await fetch(
          "https://voice-feedback-api-7329c580eca3.herokuapp.com/conversation",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              agentId: agentId,
            }),
          }
        );
        const conversationData = await conversationResponse.json();
        currentConversationId = conversationData.data.conversationId;

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

        // Add audio analysis to detect speaking
        let audioContext;
        let audioSource;
        let analyser;
        const voiceIndicator = document.querySelector(".inner-circle");

        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];

          // Set up audio analysis
          if (!audioContext) {
            console.log("Setting up audio analysis...");
            audioContext = new AudioContext();
            audioSource = audioContext.createMediaStreamSource(e.streams[0]);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            audioSource.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function updateVoiceIndicator() {
              analyser.getByteFrequencyData(dataArray);

              // Calculate average volume
              const average =
                dataArray.reduce((a, b) => a + b) / dataArray.length;

              const minScale = 1;
              const maxScale = 1.5;
              const scale = minScale + (average / 255) * (maxScale - minScale);

              // Apply transform to the voice-indicator instead of inner-circle
              const voiceIndicator = document.querySelector(".voice-indicator");
              if (!voiceIndicator) {
                console.error("Voice indicator element not found!");
                return;
              }

              voiceIndicator.style.transform = `scale(${scale})`;
              requestAnimationFrame(updateVoiceIndicator);
            }

            console.log("Starting animation loop...");
            updateVoiceIndicator();
          }
        };

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

        dc.addEventListener("message", async (e) => {
          try {
            const messageData = JSON.parse(e.data);

            // Store agent messages
            if (messageData.type === "response.audio_transcript.done") {
              await fetch(
                `https://voice-feedback-api-7329c580eca3.herokuapp.com/conversation/${currentConversationId}/message`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    content: messageData.transcript,
                    speaker: "agent",
                  }),
                }
              );
            }

            // Store user messages
            if (
              messageData.type ===
              "conversation.item.input_audio_transcription.completed"
            ) {
              await fetch(
                `https://voice-feedback-api-7329c580eca3.herokuapp.com/conversation/${currentConversationId}/message`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    content: messageData.transcript,
                    speaker: "user",
                  }),
                }
              );
            }

            console.table("Message type:", messageData); // Debug log

            if (messageData.type === "session.created") {
              // Get all relevant elements
              const spinner = document.getElementById("loading-spinner");
              const endButton = document.getElementById("end-session");
              const voiceIndicatorContainer = document.querySelector(
                ".voice-indicator-container"
              );

              // Fade out spinner
              spinner.style.opacity = "0";
              spinner.style.transition = "opacity 0.3s ease";

              // After spinner fades out completely (300ms), handle the transition
              setTimeout(() => {
                spinner.style.display = "none";

                // Show and animate voice indicator
                voiceIndicatorContainer.style.display = "flex";

                // Small delay to ensure display: flex has taken effect
                setTimeout(() => {
                  voiceIndicatorContainer.classList.add("voice-indicator-show");
                  // Show end button at the same time as voice indicator animation
                  endButton.style.display = "block";
                  endButton.style.opacity = "0";
                  // Fade in the end button
                  setTimeout(() => {
                    endButton.style.opacity = "1";
                    endButton.style.transition = "opacity 0.3s ease";
                  }, 50);
                }, 50);
              }, 300);

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
            } else if (messageData.type === "response.audio_transcript.done") {
              // Mark the current message as complete
              currentMessage = null;
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

          const endButton = document.getElementById("end-session");
          const voiceIndicatorContainer = document.querySelector(
            ".voice-indicator-container"
          );

          // Hide voice indicator and end button
          voiceIndicatorContainer.classList.remove("voice-indicator-show");
          voiceIndicatorContainer.style.display = "none";
          endButton.style.display = "none";

          document.getElementById("start-session").style.display = "block";
        });

        // Error handling for the connection
        pc.onicecandidateerror = () => {
          spinner.style.display = "none";
          startButton.style.display = "block";
          alert("Failed to establish connection. Please try again.");
        };
      } catch (error) {
        // Show start button and hide spinner on error
        document.getElementById("loading-spinner").style.display = "none";
        document.getElementById("start-session").style.display = "block";
        console.error("Error:", error);
        document.body.innerHTML =
          "<h1>Error: Could not start conversation</h1>";
      }
    });
}

// Function to update the transcript
function updateTranscript(newText, speaker, isDone = false) {
  if (!transcriptDiv) {
    console.error("Transcript div not found");
    return;
  }

  // Create new message bubble if we don't have one or if previous message is done
  if (!currentMessage || isDone) {
    // Mark previous messages as older
    const existingMessages = transcriptDiv.querySelectorAll(".message-bubble");
    existingMessages.forEach((msg) => {
      msg.classList.add("older");
    });

    const template = document.getElementById("assistant-message");
    if (!template) {
      console.error("Assistant message template not found");
      return;
    }

    currentMessage = template.content
      .cloneNode(true)
      .querySelector(".message-bubble");
    currentMessage.classList.add("new");

    transcriptDiv.appendChild(currentMessage);

    // Force a reflow to ensure the animation triggers
    void currentMessage.offsetWidth;

    // Scroll with offset for padding
    transcriptDiv.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Get the paragraph element inside the current message bubble
  const messageParagraph = currentMessage.querySelector(".transcript-message");
  messageParagraph.textContent += newText;

  // Ensure scroll position is maintained during updates
  requestAnimationFrame(() => {
    transcriptDiv.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

// Initialize when page loads
initializeAgent();
