const chatsContainer = document.querySelector(".chat-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const appHeader = document.querySelector(".app-header");
const suggestions = document.querySelector(".suggestions");
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const deleteChatBtn = document.getElementById("delete-chat-btn");
const addFileBtn = document.getElementById("add-file-btn");

let userMessage = "";
const chatHistory = [];
let isLightMode = false;
let attachedFile = null; // Store attached file

// API Setup - Current Gemini Models (2025)
const API_KEY = "AIzaSyD1XFE8XnjRav6NC6S-or3eBV1eg-S2VOQ";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// Function to create message elements
const createMsgElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
}

// Hide header and suggestions when chat starts
const hideHeaderAndSuggestions = () => {
    appHeader.style.display = "none";
    suggestions.style.display = "none";
}

// Show header and suggestions (when chat is cleared)
const showHeaderAndSuggestions = () => {
    appHeader.style.display = "block";
    suggestions.style.display = "flex";
}

// Check if chat is empty to show/hide header
const shouldShowHeader = () => {
    return chatHistory.length === 0 && chatsContainer.children.length === 0;
}

// Generate response using real Gemini API
const generateResponse = async (botMsgDiv) => {
    const messageText = botMsgDiv.querySelector(".message-text");

    try {
        messageText.textContent = "Thinking...";
        
        // Add user message to chat history for context
        chatHistory.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        // Prepare request body with full conversation history
        const requestBody = {
            contents: chatHistory,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        console.log("Sending request to:", API_URL);

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error:", errorText);
            
            // Handle specific error cases
            if (response.status === 404) {
                throw new Error("Model not found. The API endpoint might be incorrect.");
            } else if (response.status === 403) {
                throw new Error("API key invalid or quota exceeded.");
            } else if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please try again later.");
            } else {
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }
        }

        const data = await response.json();
        console.log("API Response:", data);

        // Extract the AI response with better error checking
        console.log("Full API response:", JSON.stringify(data, null, 2));
        
        let aiResponse = "";
        
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            console.log("First candidate:", candidate);
            
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                aiResponse = candidate.content.parts[0].text;
                console.log("Extracted AI response:", aiResponse);
            } else {
                console.error("No content.parts found in candidate");
                throw new Error("No response text found in API response");
            }
        } else {
            console.error("No candidates found in response");
            throw new Error("No candidates in API response");
        }
        
        if (!aiResponse || aiResponse.trim() === "") {
            throw new Error("Empty response from Gemini API");
        }
        
        // Add AI response to chat history
        chatHistory.push({
            role: "model", 
            parts: [{ text: aiResponse }]
        });

        // Display the response with typing animation
        typeMessage(messageText, aiResponse);
        botMsgDiv.classList.remove("loading");
        
        console.log("Response displayed successfully!");

    } catch (error) {
        console.error("Error:", error);
        
        // Remove from history if there was an error
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "user") {
            chatHistory.pop();
        }
        
        messageText.textContent = `❌ ${error.message}`;
        botMsgDiv.classList.remove("loading");
        
        // Add retry button for failed requests
        const retryBtn = document.createElement("button");
        retryBtn.textContent = "↻ Retry";
        retryBtn.style.cssText = "margin-left: 10px; padding: 5px 10px; border-radius: 5px; border: 1px solid #ccc; background: #f0f0f0; cursor: pointer;";
        retryBtn.onclick = () => {
            retryBtn.remove();
            generateResponse(botMsgDiv);
        };
        botMsgDiv.appendChild(retryBtn);
    }
}

// Typing animation for bot messages
const typeMessage = (element, text) => {
    element.textContent = "";
    let i = 0;
    const typing = setInterval(() => {
        element.textContent += text.charAt(i);
        i++;
        // Auto scroll while typing
        chatsContainer.scrollTop = chatsContainer.scrollHeight;
        
        if (i === text.length) {
            clearInterval(typing);
        }
    }, 20); // Adjust speed as needed
}

// Handle the form submission
const handleFormSubmit = (e) => {
    e.preventDefault();
    userMessage = promptInput.value.trim();

    if (!userMessage && !attachedFile) return;

    // Hide header and suggestions when sending first message
    if (shouldShowHeader()) {
        hideHeaderAndSuggestions();
    }

    // Disable input while processing
    promptInput.disabled = true;
    
    // Create message content
    let messageContent = "";
    if (attachedFile) {
        messageContent = `📎 ${attachedFile.name} (${(attachedFile.size / 1024).toFixed(1)} KB)\n\n${userMessage}`;
    } else {
        messageContent = userMessage;
    }
    
    promptInput.value = "";
    clearFilePreview(); // Clear file preview from input area

    // Generate user message html and add into chat container
    const userMsgHTML = `<p class="message-text"></p>`;
    const userMsgDiv = createMsgElement(userMsgHTML, "user-message");

    userMsgDiv.querySelector(".message-text").textContent = messageContent;
    chatsContainer.appendChild(userMsgDiv);

    // Reset attached file
    attachedFile = null;

    // Scroll to bottom
    chatsContainer.scrollTop = chatsContainer.scrollHeight;

    setTimeout(() => {
        // Generate bot message html and add into chat container
        const botMsgHTML = `<img src="gemini-chatbot-logo.svg" class="avatar" alt="Gemini"><p class="message-text">Thinking...</p>`;
        const botMsgDiv = createMsgElement(botMsgHTML, "bot-message", "loading");
        chatsContainer.appendChild(botMsgDiv);
        
        // Scroll to bottom
        chatsContainer.scrollTop = chatsContainer.scrollHeight;
        
        generateResponse(botMsgDiv).finally(() => {
            // Re-enable input after response
            promptInput.disabled = false;
            promptInput.focus();
        });
    }, 600);
}

// Handle suggestion clicks
const handleSuggestionClick = (suggestionText) => {
    promptInput.value = suggestionText;
    handleFormSubmit(new Event('submit'));
}

// Clear chat function
const clearChat = () => {
    chatsContainer.innerHTML = "";
    chatHistory.length = 0;
    clearFilePreview(); // Clear any file preview
    showHeaderAndSuggestions();
    promptInput.focus();
    promptInput.placeholder = "Ask Gemini"; // Reset placeholder
    console.log("Chat cleared");
};

// Toggle theme function
const toggleTheme = () => {
    isLightMode = !isLightMode;
    
    if (isLightMode) {
        document.documentElement.style.setProperty('--text-color', '#2c3e50');
        document.documentElement.style.setProperty('--subheading-color', '#5a6c7d');
        document.documentElement.style.setProperty('--placeholder-color', '#7f8c8d');
        document.documentElement.style.setProperty('--primary-color', '#f8f9fa');
        document.documentElement.style.setProperty('--secondary-color', '#e9ecef');
        document.documentElement.style.setProperty('--secondary-hover-color', '#dee2e6');
        document.documentElement.style.setProperty('--scrollbar-color', '#adb5bd');
        themeToggleBtn.textContent = 'dark_mode';
    } else {
        document.documentElement.style.setProperty('--text-color', '#edf3ff');
        document.documentElement.style.setProperty('--subheading-color', '#97a7ca');
        document.documentElement.style.setProperty('--placeholder-color', '#c3cdde');
        document.documentElement.style.setProperty('--primary-color', '#101623');
        document.documentElement.style.setProperty('--secondary-color', '#283045');
        document.documentElement.style.setProperty('--secondary-hover-color', '#333e58');
        document.documentElement.style.setProperty('--scrollbar-color', '#626a7f');
        themeToggleBtn.textContent = 'light_mode';
    }
}

// Show file preview inside input area (compact like ChatGPT)
const showFilePreview = (file) => {
    const promptForm = document.querySelector('.prompt-form');
    
    // Create compact file preview element
    const filePreview = document.createElement('div');
    filePreview.className = 'file-preview-inline';
    filePreview.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--secondary-hover-color); border-radius: 12px; margin: 6px 20px 4px 20px; font-size: 0.85rem; max-width: fit-content;">
            📎 <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name}</span>
            <button onclick="clearFilePreview()" style="background: none; border: none; color: var(--placeholder-color); cursor: pointer; font-size: 14px; padding: 0 2px; margin-left: 4px;">×</button>
        </div>
    `;
    
    // Insert at the top of the prompt form
    promptForm.insertBefore(filePreview, promptForm.firstChild);
    
    // Change placeholder and focus
    promptInput.placeholder = "Ask something about this file...";
    promptInput.focus();
}

// Clear file preview
const clearFilePreview = () => {
    const filePreview = document.querySelector('.file-preview-inline');
    if (filePreview) {
        filePreview.remove();
    }
    attachedFile = null;
    promptInput.placeholder = "Ask Gemini";
}

// File upload functionality
const handleFileUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.pdf,.txt,.doc,.docx';
    fileInput.style.display = 'none';
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Clear any existing file preview
            clearFilePreview();
            
            // Store the attached file
            attachedFile = file;
            
            // Show compact file preview in input area
            showFilePreview(file);
        }
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

// Event Listeners
promptForm.addEventListener("submit", handleFormSubmit);
themeToggleBtn.addEventListener("click", toggleTheme);
deleteChatBtn.addEventListener("click", clearChat);
addFileBtn.addEventListener("click", handleFileUpload);

// Add click handlers to suggestion items
document.querySelectorAll('.suggestions-item').forEach(item => {
    item.addEventListener('click', () => {
        const suggestionText = item.querySelector('.text').textContent.trim();
        handleSuggestionClick(suggestionText);
    });
});

// Focus input on page load and ensure header is visible
document.addEventListener("DOMContentLoaded", () => {
    // Force show header and suggestions on page load (override CSS)
    appHeader.style.display = "block";
    suggestions.style.display = "flex";
    promptInput.focus();
});

// Keyboard shortcuts
promptInput.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
        handleFormSubmit(e);
    }
});

// Optional: Add Escape key to clear chat
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        clearChat();
    }
});

// Export chat history function
const exportChat = () => {
    const chatData = {
        timestamp: new Date().toISOString(),
        messages: chatHistory
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

console.log("Gemini Clone initialized successfully!");
console.log("Using model: gemini-2.5-flash");
console.log("Features: Real API, Chat history, Typing animation, Error handling, Theme toggle, Clickable suggestions");
console.log("Keyboard shortcuts: Ctrl+Enter (send), Escape (clear chat)");