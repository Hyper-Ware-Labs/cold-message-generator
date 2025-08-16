// Popup script for the LinkedIn message generator
document.addEventListener("DOMContentLoaded", function () {
  const llmProviderSelect = document.getElementById("llmProvider");
  const apiKeyInput = document.getElementById("apiKey");
  const apiKeyLabel = document.getElementById("apiKeyLabel");
  const apiKeyHelp = document.getElementById("apiKeyHelp");
  const serviceTypeSelect = document.getElementById("serviceType");
  const customServiceInput = document.getElementById("customService");
  const extractBtn = document.getElementById("extractBtn");
  const generateBtn = document.getElementById("generateBtn");
  const statusDiv = document.getElementById("status");
  const generatedMessageDiv = document.getElementById("generatedMessage");
  const copyBtn = document.getElementById("copyBtn");

  let currentProfileData = null;
  let cleanMessage = ""; // Store the clean message separately

  // Load saved settings
  chrome.storage.local.get(
    ["apiKey", "serviceType", "customService", "llmProvider"],
    function (result) {
      if (result.apiKey) apiKeyInput.value = result.apiKey;
      if (result.serviceType) serviceTypeSelect.value = result.serviceType;
      if (result.customService) customServiceInput.value = result.customService;
      if (result.llmProvider) llmProviderSelect.value = result.llmProvider;
      updateApiKeyLabel();
    }
  );

  // Update API key label based on provider
  function updateApiKeyLabel() {
    const provider = llmProviderSelect.value;
    switch (provider) {
      case "groq":
        apiKeyLabel.textContent = "Groq API Key:";
        apiKeyInput.placeholder = "gsk_...";
        apiKeyHelp.textContent = "Get free key from console.groq.com";
        break;
      case "perplexity":
        apiKeyLabel.textContent = "Perplexity API Key:";
        apiKeyInput.placeholder = "pplx-...";
        apiKeyHelp.textContent = "Get from perplexity.ai settings";
        break;
      case "huggingface":
        apiKeyLabel.textContent = "HuggingFace Token:";
        apiKeyInput.placeholder = "hf_...";
        apiKeyHelp.textContent = "Get from huggingface.co/settings/tokens";
        break;
      case "openai":
        apiKeyLabel.textContent = "OpenAI API Key:";
        apiKeyInput.placeholder = "sk-...";
        apiKeyHelp.textContent = "Get from platform.openai.com";
        break;
    }
  }

  llmProviderSelect.addEventListener("change", function () {
    updateApiKeyLabel();
    saveSettings();
  });

  // Save settings on change
  function saveSettings() {
    chrome.storage.local.set({
      apiKey: apiKeyInput.value,
      serviceType: serviceTypeSelect.value,
      customService: customServiceInput.value,
      llmProvider: llmProviderSelect.value,
    });
  }

  apiKeyInput.addEventListener("change", saveSettings);
  serviceTypeSelect.addEventListener("change", saveSettings);
  customServiceInput.addEventListener("change", saveSettings);

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";

    if (type === "success") {
      setTimeout(() => {
        statusDiv.style.display = "none";
      }, 3000);
    }
  }

  function getServiceDescription() {
    if (serviceTypeSelect.value === "custom") {
      return customServiceInput.value || "IT services";
    }

    const serviceDescriptions = {
      "web-development": [
        "custom web development and modern web applications",
        "JavaScript, React, Node.js, HTML, CSS",
      ],
      "mobile-app": [
        "mobile app development for iOS and Android",
        "Swift, Kotlin, React Native, Flutter",
      ],
      "cloud-services": [
        "cloud infrastructure and DevOps solutions",
        "AWS, Azure, Docker, Kubernetes",
      ],
      "ai-ml": [
        "AI and machine learning solutions",
        "Python, TensorFlow, PyTorch, scikit-learn",
      ],
    };

    // const serviceSkills = {
    //   "web-development": ["JavaScript", "React", "Node.js", "HTML", "CSS"],
    //   "mobile-app": ["Swift", "Kotlin", "React Native", "Flutter"],
    //   "cloud-services": ["AWS", "Azure", "Docker", "Kubernetes"],
    //   "ai-ml": ["Python", "TensorFlow", "PyTorch", "scikit-learn"],
    // };

    return serviceDescriptions[serviceTypeSelect.value];
  }

  // Function to extract clean message from LLM response
  function extractCleanMessage(fullResponse) {
    // Remove common prefixes and explanatory text
    let cleaned = fullResponse
      .replace(/^Here's a personalized LinkedIn cold outreach message.*?:/i, "")
      .trim();

    // Extract text between quotes if present
    const quoteMatch = cleaned.match(/[""]([^""]+)[""]|"([^"]+)"/);
    if (quoteMatch) {
      return (quoteMatch[1] || quoteMatch[2]).trim();
    }

    // If no quotes, try to find the main message by looking for common patterns
    const lines = cleaned.split("\n");
    let messageLines = [];
    let foundMessage = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Skip explanatory lines
      if (
        line.toLowerCase().includes("this message") ||
        line.toLowerCase().includes("character") ||
        line.toLowerCase().includes("includes:") ||
        line.toLowerCase().includes("requirements:") ||
        line.startsWith("- ") ||
        line.startsWith("* ")
      ) {
        break;
      }

      // Start collecting message lines after finding the greeting
      if (
        !foundMessage &&
        (line.toLowerCase().startsWith("hi ") ||
          line.toLowerCase().startsWith("hello ") ||
          line.toLowerCase().startsWith("hey "))
      ) {
        foundMessage = true;
      }

      if (foundMessage) {
        messageLines.push(line);
      }
    }

    if (messageLines.length > 0) {
      return messageLines.join("\n").trim();
    }

    // Fallback: return first paragraph if nothing else works
    const firstParagraph = cleaned.split("\n\n")[0];
    return firstParagraph.length < 500
      ? firstParagraph.trim()
      : cleaned.substring(0, 300).trim();
  }

  async function generateMessage(profileData) {
    const apiKey = apiKeyInput.value.trim();
    const provider = llmProviderSelect.value;

    if (!apiKey) {
      showStatus(
        `Please enter your ${provider.toUpperCase()} API key`,
        "error"
      );
      return;
    }

    const serviceDescription = getServiceDescription();

    const prompt = `You are a professional networking expert. Write a personalized LinkedIn connection request message using the following information:

PROFILE DATA:
Name: ${profileData.name}
Current Role: ${profileData.headline || "Not specified"}
Company: ${profileData.company || "Not specified"}
Location: ${profileData.location || "Not specified"}
About Section: ${
      profileData.about
        ? profileData.about.substring(0, 200) + "..."
        : "Not available"
    }
Skills: ${profileData.skills.join(", ") || "Not specified"}

MY SERVICE OFFERING:
Service: ${serviceDescription[0]}
My Key Skills: ${serviceDescription[1]}

REQUIREMENTS:
1. Maximum 200 characters (LinkedIn's connection request limit)
2. Professional yet approachable tone
3. Reference something specific from their profile/about section to show genuine interest
4. Highlight how your service aligns with their needs or industry
5. Mention a relevant skill from your expertise that matches their work
6. Include a soft call-to-action for connection
7. Avoid generic/automated language

SKILL MATCHING PRIORITY:
- If they list skills that match your service area, mention the overlapping skill
- Otherwise, mention your most relevant couple skills: ${serviceDescription[1].split(
      ", "
    )}
- Include frameworks and tech stacks, make sure they are all rounded for the job

OUTPUT: Return ONLY the connection request message text. No explanations, quotes, or additional formatting.Keep it 200 characters or less strictly.`;

    try {
      showStatus("Generating personalized message...", "success");

      let response;

      switch (provider) {
        case "groq":
          response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant", // Fast and good quality
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a professional outreach specialist. Write ONLY the LinkedIn connection message text, without any explanations, formatting, or additional commentary.",
                  },
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
                max_tokens: 120,
                temperature: 0.7,
              }),
            }
          );
          break;

        case "perplexity":
          response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.1-sonar-small-128k-online",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a professional outreach specialist. Write ONLY the LinkedIn connection message text, without any explanations, formatting, or additional commentary.",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              max_tokens: 120,
              temperature: 0.7,
            }),
          });
          break;

        case "huggingface":
          response = await fetch(
            "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: prompt,
                parameters: {
                  max_length: 120,
                  temperature: 0.7,
                },
              }),
            }
          );
          break;

        case "openai":
        default:
          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a professional outreach specialist. Write ONLY the LinkedIn connection message text, without any explanations, formatting, or additional commentary.",
                },
                {
                  role: "user",
                  content: prompt,
                },
              ],
              max_tokens: 120,
              temperature: 0.7,
            }),
          });
          break;
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      let fullMessage;

      if (provider === "huggingface") {
        fullMessage = data[0]?.generated_text || "Unable to generate message";
      } else {
        fullMessage = data.choices[0].message.content
          .trim()
          .replace(/[""]/g, '"');
      }

      // Extract the clean message
      cleanMessage = extractCleanMessage(fullMessage);

      // Display both for user to see what was generated
      generatedMessageDiv.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px;">Generated Message:</div>
                <div style="background-color: #e3f2fd; padding: 8px; border-radius: 4px; border-left: 3px solid #2196f3;">
                    ${cleanMessage}
                </div>
                <div style="font-size: 10px; color: #666; margin-top: 8px;">
                    Characters: ${cleanMessage.length}/300
                </div>
            `;

      generatedMessageDiv.style.display = "block";
      copyBtn.style.display = "block";
      generateBtn.style.display = "block";

      showStatus("Message generated successfully!", "success");
    } catch (error) {
      console.error("Error generating message:", error);
      showStatus(`Error: ${error.message}`, "error");
    }
  }

  extractBtn.addEventListener("click", async function () {
    const provider = llmProviderSelect.value;
    if (!apiKeyInput.value.trim()) {
      showStatus(
        `Please enter your ${provider.toUpperCase()} API key first`,
        "error"
      );
      return;
    }

    try {
      showStatus("Extracting profile data...", "success");

      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.url.includes("linkedin.com/in/")) {
        showStatus("Please navigate to a LinkedIn profile page first", "error");
        return;
      }

      // Extract profile data from the content script
      chrome.tabs.sendMessage(
        tab.id,
        { action: "extractProfile" },
        async function (response) {
          if (chrome.runtime.lastError) {
            showStatus(
              "Error: Please refresh the LinkedIn page and try again",
              "error"
            );
            return;
          }

          if (response) {
            currentProfileData = response;
            console.log("Received profile data:", currentProfileData);
            await generateMessage(currentProfileData);
          } else {
            showStatus(
              "Could not extract profile data. Please refresh the page.",
              "error"
            );
          }
        }
      );
    } catch (error) {
      console.error("Error:", error);
      showStatus("Error extracting profile data", "error");
    }
  });

  generateBtn.addEventListener("click", function () {
    if (currentProfileData) {
      generateMessage(currentProfileData);
    }
  });

  copyBtn.addEventListener("click", function () {
    // Copy only the clean message, not the full response
    navigator.clipboard.writeText(cleanMessage).then(
      function () {
        showStatus("Message copied to clipboard!", "success");
        // Briefly highlight what was copied
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy Message";
        }, 2000);
      },
      function () {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = cleanMessage;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        showStatus("Message copied to clipboard!", "success");
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy Message";
        }, 2000);
      }
    );
  });
});
