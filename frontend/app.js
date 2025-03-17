// Define utility functions outside of the DOMContentLoaded event handler
// so they can be exported for testing

/**
 * Displays transcript and insights in the UI with animation and formatting.
 * Renders the transcript with line numbering and the insights with proper markdown styling.
 * Applies fade-in animation to both panes for a smoother user experience.
 * 
 * @param {Object} result - Contains transcript and insights from the API
 * @param {string} result.transcript - Raw text transcript from the audio file
 * @param {string} result.insights - Markdown-formatted insights text with headings and lists
 * 
 * @example
 * // After API response is received
 * const result = await response.json();
 * displayResults(result);
 */
function displayResults(result) {
    const transcriptEl = document.getElementById("transcript");
    const insightsEl = document.getElementById("insights");
  
    // Apply transcript with line-by-line formatting
    transcriptEl.innerHTML = result.transcript
      .split("\n")
      .map(
        (line, index) =>
          `<span id='transcript-${index}' class='transcript-line'>${line}</span>`
      )
      .join("<br>");
  
    // Store the original markdown for copying
    insightsEl.setAttribute("data-markdown", result.insights);
  
    // Display insights with improved formatting
    insightsEl.innerHTML = result.insights
      .split("\n")
      .map((line, index) => {
        // Format checkbox items nicely without making them interactive
        if (line.trim().match(/^- \[ \]/)) {
          const taskText = line.replace(/^- \[ \]/, "").trim();
          return `<div class="task-item">
                      <span class="checkbox-display">☐</span>
                      <span class="insight-line" onclick="highlightTranscript(${index})">${taskText}</span>
                  </div>`;
        }
        // Format checked items if they exist
        else if (line.trim().match(/^- \[x\]/i)) {
          const taskText = line.replace(/^- \[x\]/i, "").trim();
          return `<div class="task-item">
                      <span class="checkbox-display checked">☑</span>
                      <span class="insight-line" onclick="highlightTranscript(${index})">${taskText}</span>
                  </div>`;
        }
        // Format bullet points to be clickable
        else if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
          return `<span class='insight-line' onclick='highlightTranscript(${index})'>${line}</span>`;
        }
        // Format headings with special styling
        else if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
          return `<h3 class="insight-heading">${line}</h3>`;
        }
        // Headers and other formatting
        else {
          return `<span>${line}</span>`;
        }
      })
      .join("<br>");
  
    // Add entrance animation for content
    transcriptEl.style.opacity = "0";
    insightsEl.style.opacity = "0";
  
    setTimeout(() => {
      transcriptEl.style.transition = "opacity 0.5s ease";
      insightsEl.style.transition = "opacity 0.5s ease";
      transcriptEl.style.opacity = "1";
      insightsEl.style.opacity = "1";
    }, 100);
  }
  
  /**
   * Toggles the visibility state and layout of a specific pane.
   * Handles transitions between expanded and collapsed states, updates copy button states,
   * and adjusts the layout based on screen size and pane states.
   * 
   * @param {string} paneId - ID of the pane to toggle ('transcript-pane' or 'insights-pane')
   * @param {Event} [event] - Optional click event object to prevent propagation
   * 
   * @example
   * // Toggle the transcript pane
   * togglePane('transcript-pane', event);
   * 
   * // Toggle the insights pane programmatically (no event)
   * togglePane('insights-pane');
   */
  function togglePane(paneId, event) {
    console.log("[Client] Toggle pane called for:", paneId);
    // Prevent event propagation
    if (event) event.stopPropagation();
  
    const transcriptPane = document.getElementById("transcript-pane");
    const insightsPane = document.getElementById("insights-pane");
    const paneContainer = document.querySelector(".pane-container");
  
    // Get the clicked pane
    const clickedPane = document.getElementById(paneId);
  
    // Get the corresponding copy button for the clicked pane
    const copyButton =
      paneId === "transcript-pane"
        ? document.getElementById("copy-transcript-btn")
        : document.getElementById("copy-insights-btn");
  
    // Add subtle animation before changing state
    if (!clickedPane.classList.contains("collapsed")) {
      clickedPane.style.transform = "scale(0.98)";
      setTimeout(() => {
        clickedPane.style.transform = "";
      }, 200);
    }
  
    // Toggle the clicked pane's collapsed state
    clickedPane.classList.toggle("collapsed");
  
    // Toggle the disabled state of the copy button
    copyButton.classList.toggle(
      "disabled",
      clickedPane.classList.contains("collapsed")
    );
  
    // Apply layout changes based on current states
    const transcriptCollapsed = transcriptPane.classList.contains("collapsed");
    const insightsCollapsed = insightsPane.classList.contains("collapsed");
  
    // Check if we're in mobile view (portrait mode on most phones)
    const isMobileView = window.innerWidth <= 768;
  
    console.log(
      "[Client] Pane states - Transcript collapsed:",
      transcriptCollapsed,
      "Insights collapsed:",
      insightsCollapsed,
      "Mobile view:",
      isMobileView
    );
  
    // Always use stacked layout on mobile, otherwise use stacked only when a pane is collapsed
    const useStackedLayout =
      isMobileView || transcriptCollapsed || insightsCollapsed;
  
    // Apply the stacking or side-by-side layout based on collapsed states and screen size
    if (useStackedLayout) {
      // Stacked layout - switch to column direction
      paneContainer.style.flexDirection = "column";
  
      // Add a slight delay for smoother transition
      setTimeout(() => {
        transcriptPane.style.width = "100%";
        insightsPane.style.width = "100%";
  
        // MODIFIED ORDERING LOGIC:
        // Transcript pane is always first (on top), insights always second (below)
        transcriptPane.style.order = "1";
        insightsPane.style.order = "2";
  
        // Remove flex properties to ensure proper stacking
        transcriptPane.style.flex = "";
        insightsPane.style.flex = "";
      }, 10);
    } else {
      // Side-by-side layout with 1:2 ratio (only used on larger screens when both panes expanded)
      paneContainer.style.flexDirection = "row";
  
      // Add a slight delay for smoother transition
      setTimeout(() => {
        transcriptPane.style.flex = "1";
        insightsPane.style.flex = "2";
        transcriptPane.style.order = "1";
        insightsPane.style.order = "2";
        transcriptPane.style.width = "";
        insightsPane.style.width = "";
      }, 10);
    }
  
    console.log(
      "[Client] Layout updated - Using stacked layout:",
      useStackedLayout
    );
  }
  
  /**
   * Highlights a specific line in the transcript and scrolls to it.
   * Removes any existing highlights, adds highlight to the selected line,
   * and ensures the transcript pane is expanded before scrolling to the line.
   * 
   * @param {number} index - Index of the transcript line to highlight
   * 
   * @example
   * // Highlight line 5 of the transcript
   * highlightTranscript(5);
   */
  function highlightTranscript(index) {
    // Remove previous highlights
    document.querySelectorAll(".transcript-line").forEach((el) => {
      el.classList.remove("highlight");
      el.style.transition = "background-color 0.3s ease";
    });
  
    // Add highlight to selected line
    const transcriptLine = document.getElementById(`transcript-${index}`);
    if (transcriptLine) {
      transcriptLine.classList.add("highlight");
  
      // Expand transcript pane if it's collapsed
      const transcriptPane = document.getElementById("transcript-pane");
      if (transcriptPane.classList.contains("collapsed")) {
        togglePane("transcript-pane", null);
  
        // Delay scrolling until after expansion animation
        setTimeout(() => {
          transcriptLine.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 400);
      } else {
        transcriptLine.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }
  
  /**
   * Uploads and processes an audio file.
   * Shows loading indicators, sends the file to the backend API,
   * and displays the resulting transcript and insights.
   * Handles success and error cases with appropriate notifications.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} When upload or processing fails
   * 
   * @example
   * // When user clicks upload button
   * document.getElementById('upload-button').addEventListener('click', uploadFile);
   */
  async function uploadFile() {
    const uploadButton = document.getElementById("audio-upload");
    const file = uploadButton.files[0];
    if (!file) {
      showNotification("Please select a file to upload.", "warning");
      return;
    }
  
    // Show loading indicator with animation
    const loadingIndicator = document.getElementById("loading-indicator");
    loadingIndicator.style.display = "block";
    loadingIndicator.style.opacity = "0";
    setTimeout(() => {
      loadingIndicator.style.opacity = "1";
    }, 10);
  
    document.getElementById("transcript").innerHTML =
      "<div class='processing-text'>Transcribing...</div>";
    document.getElementById("insights").innerHTML =
      "<div class='processing-text'>Analyzing...</div>";
  
    const formData = new FormData();
    formData.append("audio", file);
  
    try {
      // Show upload started notification
      showNotification("Uploading and processing file...", "info");
  
      const response = await fetch("http://localhost:3000/upload", {
        method: "POST",
        body: formData,
      });
  
      if (!response.ok) throw new Error("Failed to upload file");
  
      const result = await response.json();
  
      // Hide loading indicator with fade out
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";
  
        // Display results with animation
        displayResults(result);
  
        // Show success notification
        showNotification("File processed successfully!", "success");
      }, 400);
    } catch (error) {
      // Hide loading indicator with fade out
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";
      }, 400);
  
      console.error("error:", error);
      showNotification("Error uploading file. Please try again.", "error");
    }
  }
  
  /**
   * Displays a notification popup with an optional type.
   * Creates a styled notification element, adds it to the document body,
   * and handles automatic dismissal after a delay.
   * 
   * @param {string} message - The notification text to display
   * @param {string} [type='info'] - Notification type: 'info', 'success', 'warning', or 'error'
   * 
   * @example
   * // Show success notification
   * showNotification('File processed successfully!', 'success');
   * 
   * // Show error notification
   * showNotification('Error uploading file. Please try again.', 'error');
   */
  function showNotification(message, type = "info") {
    // Remove any existing notifications
    const existingNotification = document.querySelector(".notification");
    if (existingNotification) {
      existingNotification.remove();
    }
  
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
  
    // Create close button
    const closeButton = document.createElement("span");
    closeButton.className = "notification-close";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function () {
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.remove();
      }, 300);
    };
  
    notification.appendChild(closeButton);
  
    // Add to document
    document.body.appendChild(notification);
  
    // Add styles if not already added
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
              .notification {
                  position: fixed;
                  top: 20px;
                  right: 20px;
                  padding: 12px 30px 12px 20px;
                  border-radius: 6px;
                  color: white;
                  font-size: 14px;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.16);
                  z-index: 1000;
                  transition: all 0.3s ease;
                  opacity: 0;
              }
              .notification.success {
                  background-color: #28a745;
              }
              .notification.error {
                  background-color: #dc3545;
              }
              .notification.warning {
                  background-color: #ffc107;
                  color: #333;
              }
              .notification.info {
                  background-color: #17a2b8;
              }
              .notification-close {
                  position: absolute;
                  top: 8px;
                  right: 10px;
                  cursor: pointer;
                  font-size: 16px;
              }
              .processing-text {
                  color: #6c757d;
                  font-style: italic;
              }
          `;
      document.head.appendChild(style);
    }
  
    // Animate in
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 10);
  
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }
  
  /**
   * Initializes the application.
   * Sets up the initial layout based on screen size and performs a health check
   * to verify the backend server is running.
   * 
   * @example
   * // Initialize the app when DOM is loaded
   * document.addEventListener('DOMContentLoaded', initializeApp);
   */
  function initializeApp() {
    console.log("[Client] Initializing app.js");
  
    // Initialize layout
    initializePaneLayout();
  
    // Perform server health check
    checkServerHealth();
  }
  
  /**
   * Initializes the pane layout with responsive behavior.
   * Sets up the initial states of the transcript and insights panes based on
   * viewport size, with different layouts for mobile and desktop.
   * 
   * @example
   * // Call when window is resized
   * window.addEventListener('resize', initializePaneLayout);
   */
  function initializePaneLayout() {
    const transcriptPane = document.getElementById("transcript-pane");
    const insightsPane = document.getElementById("insights-pane");
    const paneContainer = document.querySelector(".pane-container");
    const copyTranscriptBtn = document.getElementById("copy-transcript-btn");
    const copyInsightsBtn = document.getElementById("copy-insights-btn");
  
    if (!transcriptPane || !insightsPane) {
      console.warn("[Client] Pane elements not found in DOM");
      return;
    }
  
    // Set initial button states based on pane collapsed status
    if (copyTranscriptBtn && transcriptPane) {
      copyTranscriptBtn.classList.toggle(
        "disabled",
        transcriptPane.classList.contains("collapsed")
      );
    }
  
    if (copyInsightsBtn && insightsPane) {
      copyInsightsBtn.classList.toggle(
        "disabled",
        insightsPane.classList.contains("collapsed")
      );
    }
  
    // Check if we're in mobile view
    const isMobileView = window.innerWidth <= 768;
    console.log("[Client] Initializing layout - Mobile view:", isMobileView);
  
    if (isMobileView) {
      // Mobile view - always use stacked layout
      paneContainer.style.flexDirection = "column";
      transcriptPane.style.width = "100%";
      insightsPane.style.width = "100%";
      transcriptPane.style.order = "1";
      insightsPane.style.order = "2";
      transcriptPane.style.flex = "";
      insightsPane.style.flex = "";
    } else {
      // Desktop view - use side-by-side layout with 1:2 ratio
      paneContainer.style.flexDirection = "row";
      transcriptPane.style.flex = "1";
      insightsPane.style.flex = "2";
      transcriptPane.style.order = "1";
      insightsPane.style.order = "2";
      transcriptPane.style.width = "";
      insightsPane.style.width = "";
    }
  }
  
  /**
   * Checks if the backend server is running by making a request to the health endpoint.
   * Logs the result to the console for debugging purposes.
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @example
   * // Check server health on application start
   * await checkServerHealth();
   */
  async function checkServerHealth() {
    try {
      const response = await fetch("http://localhost:3000/health");
      const data = await response.json();
      console.log("[Client] Server health check successful");
      console.log(data);
    } catch (error) {
      console.warn("[Client] Server health check failed:", error);
    }
  }
  
  // Set up event listeners when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[Client] DOM fully loaded and parsed");
  
    const uploadButton = document.getElementById("audio-upload");
    const filePathInput = document.getElementById("file-path");
    const browseButton = document.getElementById("browse-button");
    const copyInsightsBtn = document.getElementById("copy-insights-btn");
    const copyTranscriptBtn = document.getElementById("copy-transcript-btn");
  
    // Initialize layout and perform health check
    initializeApp();
  
    // Add a resize handler to adjust layout when window size changes
    window.addEventListener("resize", function () {
      // Debounce the resize event (only trigger after resizing stops)
      clearTimeout(window.resizeTimer);
      window.resizeTimer = setTimeout(function () {
        console.log("[Client] Window resized, reinitializing layout");
        initializePaneLayout();
      }, 250);
    });
  
    // Copy insights to clipboard functionality
    copyInsightsBtn.addEventListener("click", () => {
      // Check if button is disabled
      if (copyInsightsBtn.classList.contains("disabled")) {
        return; // Exit the function early if disabled
      }
  
      const insightsElement = document.getElementById("insights");
      // We need to get the original markdown text before it was converted to HTML
      // This will be stored in a data attribute
      const markdownText =
        insightsElement.getAttribute("data-markdown") ||
        insightsElement.innerText;
  
      // Copy to clipboard
      navigator.clipboard
        .writeText(markdownText)
        .then(() => {
          // Visual feedback that copy succeeded
          const originalBg = copyInsightsBtn.style.backgroundColor;
          copyInsightsBtn.style.backgroundColor = "#28a745";
          copyInsightsBtn.style.color = "white";
  
          // Add subtle scale animation
          copyInsightsBtn.style.transform = "scale(1.1)";
  
          setTimeout(() => {
            copyInsightsBtn.style.backgroundColor = originalBg;
            copyInsightsBtn.style.color = "#333";
            copyInsightsBtn.style.transform = "scale(1)";
          }, 800);
        })
        .catch((err) => {
          console.error("failed to copy: ", err);
          alert("failed to copy to clipboard");
        });
    });
  
    // Copy transcript to clipboard functionality
    copyTranscriptBtn.addEventListener("click", () => {
      // Check if button is disabled
      if (copyTranscriptBtn.classList.contains("disabled")) {
        return; // Exit the function early if disabled
      }
  
      const transcriptElement = document.getElementById("transcript");
      const transcriptText = transcriptElement.innerText;
  
      // Copy to clipboard
      navigator.clipboard
        .writeText(transcriptText)
        .then(() => {
          // Visual feedback that copy succeeded
          const originalBg = copyTranscriptBtn.style.backgroundColor;
          copyTranscriptBtn.style.backgroundColor = "#28a745";
          copyTranscriptBtn.style.color = "white";
  
          // Add subtle scale animation
          copyTranscriptBtn.style.transform = "scale(1.1)";
  
          setTimeout(() => {
            copyTranscriptBtn.style.backgroundColor = originalBg;
            copyTranscriptBtn.style.color = "#333";
            copyTranscriptBtn.style.transform = "scale(1)";
          }, 800);
        })
        .catch((err) => {
          console.error("failed to copy: ", err);
          alert("failed to copy to clipboard");
        });
    });
  
    // Connect browse button to hidden file input
    browseButton.addEventListener("click", () => {
      uploadButton.click();
    });
  
    // Update text field when file is selected
    uploadButton.addEventListener("change", (event) => {
      if (uploadButton.files.length > 0) {
        // For security reasons, browsers don't provide the full path
        // This will show just the filename instead
        filePathInput.value = uploadButton.files[0].name;
  
        // Add visual feedback
        filePathInput.style.backgroundColor = "#f0f8ff";
        setTimeout(() => {
          filePathInput.style.backgroundColor = "";
        }, 500);
      } else {
        filePathInput.value = "";
      }
    });
  
    // Make the uploadFile function accessible from HTML
    window.uploadFile = uploadFile;
  
    // Make togglePane accessible from HTML
    window.togglePane = togglePane;
  
    // Make highlightTranscript accessible from HTML
    window.highlightTranscript = highlightTranscript;
  });
  
  // Export functions for testing (only in Node.js environment)
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      displayResults,
      togglePane,
      highlightTranscript,
      uploadFile,
      showNotification,
      initializeApp,
      initializePaneLayout,
      checkServerHealth,
    };
  }