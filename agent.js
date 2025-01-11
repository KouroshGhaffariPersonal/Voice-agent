async function initializeAgent() {
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

        // Set up WebRTC
        const pc = new RTCPeerConnection();

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
          console.log("Message received:", e);
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
      } catch (error) {
        console.error("Error:", error);
        document.body.innerHTML =
          "<h1>Error: Could not start conversation</h1>";
      }
    });
}

// Initialize when page loads
initializeAgent();
