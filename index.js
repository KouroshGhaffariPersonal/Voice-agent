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

      // Create and display the shareable link
      const shareableLink = `http://127.0.0.1:5500/agent.html?id=${id}`;

      // Create a div to show the link
      const linkContainer = document.createElement("div");
      linkContainer.innerHTML = `
        <p>Share this link with your users:</p>
        <input type="text" value="${shareableLink}" readonly style="width: 100%; padding: 8px;" />
        <button onclick="navigator.clipboard.writeText('${shareableLink}')">Copy Link</button>
      `;

      // Add it after the form
      document.getElementById("voice-agent-form").after(linkContainer);
    } catch (error) {
      console.error("Error:", error);
    }
  });
