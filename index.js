document
  .getElementById("voice-agent-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();
    const textInput = document.getElementById("text-input").value;

    try {
      // Save agent instructions and get link
      const response = await fetch(
        "https://voice-feedback-api-7329c580eca3.herokuapp.com/create-agent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instructions: textInput,
          }),
        }
      );

      const { data } = await response.json();
      const id = data.id; // or data._id depending on your response
      console.log(id);

      // Update and show the link container
      const shareableLink = `http://127.0.0.1:5500/agent.html?id=${id}`;
      document.getElementById("shareable-link").value = shareableLink;
      document.getElementById("link-container").style.display = "block";
    } catch (error) {
      console.error("Error:", error);
    }
  });

// Add copy function
function copyLink() {
  const linkInput = document.getElementById("shareable-link");
  const copyButton = document.querySelector("#link-container button");

  navigator.clipboard
    .writeText(linkInput.value)
    .then(() => {
      copyButton.textContent = "Link copied";

      // Optional: Reset button text after 2 seconds
      setTimeout(() => {
        copyButton.textContent = "Copy Link";
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
    });
}
