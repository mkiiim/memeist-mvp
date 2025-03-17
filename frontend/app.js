// API Base URL
const API_BASE_URL = 'http://localhost:3000';

/**
 * Display results in the UI with animation and formatting
 * @param {Object} result - Contains transcript and insights
 */
function displayResults(result) {
  const transcriptEl = document.getElementById("transcript");
  const insightsEl = document.getElementById("insights");

  if (!transcriptEl || !insightsEl) {
    console.error("Required elements not found");
    return;
  }

  // Apply transcript with line-by-line formatting
  if (result.transcript) {
    transcriptEl.innerHTML = result.transcript
      .split("\n")
      .map(
        (line, index) =>
          `<span id='transcript-${index}' class='transcript-line'>${line}</span>`
      )
      .join("<br>");
  }

  // If insights is a string, use it directly, otherwise format from structured data
  let insightsText = result.insights;
  if (typeof result.insights !== 'string') {
    // If we have structured insights from the new API, convert back to markdown
    insightsText = result.raw_insights || formatStructuredInsights(result.insights);
  }

  // Store the original markdown for copying
  insightsEl.setAttribute("data-markdown", insightsText);

  // Display insights with improved formatting
  insightsEl.innerHTML = insightsText
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

  // Enable export buttons if they exist
  const exportMarkdownBtn = document.getElementById('export-markdown');
  const exportObsidianBtn = document.getElementById('export-obsidian');
  if (exportMarkdownBtn) exportMarkdownBtn.disabled = false;
  if (exportObsidianBtn) exportObsidianBtn.disabled = false;
}

/**
 * Format structured insights from the API into markdown format
 * @param {Object} insights - Structured insights object
 * @returns {string} - Markdown formatted insights
 */
function formatStructuredInsights(insights) {
  let markdown = '';
  
  // Summary section
  markdown += '**Transcript Summary:**\n';
  if (insights.summary && insights.summary.length > 0) {
    insights.summary.forEach(item => {
      markdown += `- ${item}\n`;
    });
  } else {
    markdown += '- No summary available\n';
  }
  markdown += '\n';
  
  // To-Do section
  markdown += '**To-Do List:**\n';
  if (insights.todo_items && insights.todo_items.length > 0) {
    insights.todo_items.forEach(item => {
      markdown += `- [ ] ${item.text}\n`;
    });
  } else {
    markdown += '- [ ] No tasks identified\n';
  }
  markdown += '\n';
  
  // Follow-ups section
  markdown += '**Follow-Ups:**\n';
  if (insights.follow_ups && insights.follow_ups.length > 0) {
    insights.follow_ups.forEach(item => {
      markdown += `- [ ] ${item.text}\n`;
    });
  } else {
    markdown += '- [ ] No follow-ups identified\n';
  }
  markdown += '\n';
  
  // References section
  markdown += '**References & Links:**\n';
  if (insights.references && insights.references.length > 0) {
    insights.references.forEach(item => {
      if (item.url) {
        markdown += `- [${item.text}](${item.url})\n`;
      } else {
        markdown += `- ${item.text}\n`;
      }
    });
  } else {
    markdown += '- No references available\n';
  }
  
  return markdown;
}

/**
 * Toggle pane visibility and layout
 * @param {string} paneId - ID of pane to toggle
 * @param {Event} event - Click event (optional)
 */
function togglePane(paneId, event) {
  console.log("[Client] Toggle pane called for:", paneId);
  // Prevent event propagation
  if (event) event.stopPropagation();

  const transcriptPane = document.getElementById("transcript-pane");
  const insightsPane = document.getElementById("insights-pane");
  const paneContainer = document.querySelector(".pane-container");

  if (!transcriptPane || !insightsPane || !paneContainer) {
    console.error("Required pane elements not found");
    return;
  }

  // Get the clicked pane
  const clickedPane = document.getElementById(paneId);
  if (!clickedPane) return;

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
  if (copyButton) {
    copyButton.classList.toggle(
      "disabled",
      clickedPane.classList.contains("collapsed")
    );
  }

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
 * Highlight transcript line and scroll to it
 * @param {number} index - Index of the transcript line
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
    if (transcriptPane && transcriptPane.classList.contains("collapsed")) {
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
 * Upload and process audio file using the new Memo API
 * This implementation uses the async pattern with polling
 */
async function uploadFile() {
  const uploadButton = document.getElementById("audio-upload");
  if (!uploadButton || !uploadButton.files || uploadButton.files.length === 0) {
    showNotification("Please select a file to upload.", "warning");
    return;
  }

  const file = uploadButton.files[0];

  // Show loading indicator with animation
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "block";
    loadingIndicator.style.opacity = "0";
    setTimeout(() => {
      loadingIndicator.style.opacity = "1";
    }, 10);
  }

  const transcriptEl = document.getElementById("transcript");
  const insightsEl = document.getElementById("insights");
  
  if (transcriptEl) transcriptEl.innerHTML = "<div class='processing-text'>Transcribing...</div>";
  if (insightsEl) insightsEl.innerHTML = "<div class='processing-text'>Analyzing...</div>";

  const formData = new FormData();
  formData.append("audio", file);
  
  // Get the selected model
  const modelSelect = document.getElementById("model-select");
  const model = modelSelect ? modelSelect.value : 'openai';
  formData.append("model", model);
  
  // Add a title based on the filename
  formData.append("title", file.name);

  try {
    // Show upload started notification
    showNotification("Uploading audio file...", "info");

    // Step 1: Create a new memo by uploading the file
    const createResponse = await fetch(`${API_BASE_URL}/v1/memos`, {
      method: "POST",
      body: formData,
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to upload file: ${createResponse.statusText}`);
    }

    const createResult = await createResponse.json();
    const memoId = createResult.id;
    
    showNotification("File uploaded. Processing in progress...", "info");
    
    // Step 2: Poll for completion
    let memo = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 attempts * 2 seconds = 60 seconds max wait time
    
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      // Wait for 2 seconds between attempts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check memo status
      const statusResponse = await fetch(`${API_BASE_URL}/v1/memos/${memoId}`);
      if (!statusResponse.ok) {
        throw new Error(`Failed to check status: ${statusResponse.statusText}`);
      }
      
      memo = await statusResponse.json();
      
      // If processing completed or failed, break the loop
      if (memo.status === 'completed' || memo.status === 'failed') {
        break;
      }
      
      // Update the loading text with attempt number to show progress
      const loadingText = document.querySelector(".loading-text");
      if (loadingText) {
        loadingText.textContent = `Processing your audio file... (${attempts}/${MAX_ATTEMPTS})`;
      }
    }
    
    // If we ran out of attempts or processing failed
    if (!memo || memo.status !== 'completed') {
      throw new Error(memo?.error?.message || "Processing timed out. Please try again.");
    }

    // Hide loading indicator with fade out
    if (loadingIndicator) {
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";

        // Display results with animation
        displayResults({
          transcript: memo.transcript,
          insights: memo.insights,
          raw_insights: memo.raw_insights
        });

        // Show success notification
        showNotification("File processed successfully!", "success");
        
        // Refresh memo list
        listMemos();
      }, 400);
    }
  } catch (error) {
    // Hide loading indicator with fade out
    if (loadingIndicator) {
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";
      }, 400);
    }

    console.error("Error:", error);
    showNotification(`Error: ${error.message}`, "error");
    
    // Clear the processing messages
    if (transcriptEl) transcriptEl.innerHTML = "No transcript available yet. Upload an audio file to get started.";
    if (insightsEl) insightsEl.innerHTML = "No insights available yet. Upload an audio file to get started.";
  }
}

/**
 * Legacy upload function using the old /upload endpoint
 * Kept for backward compatibility
 */
async function uploadFileLegacy() {
  const uploadButton = document.getElementById("audio-upload");
  if (!uploadButton || !uploadButton.files || uploadButton.files.length === 0) {
    showNotification("Please select a file to upload.", "warning");
    return;
  }

  const file = uploadButton.files[0];

  // Show loading indicator with animation
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = "block";
    loadingIndicator.style.opacity = "0";
    setTimeout(() => {
      loadingIndicator.style.opacity = "1";
    }, 10);
  }

  const transcriptEl = document.getElementById("transcript");
  const insightsEl = document.getElementById("insights");
  
  if (transcriptEl) transcriptEl.innerHTML = "<div class='processing-text'>Transcribing...</div>";
  if (insightsEl) insightsEl.innerHTML = "<div class='processing-text'>Analyzing...</div>";

  const formData = new FormData();
  formData.append("audio", file);
  
  // Get the selected model
  const modelSelect = document.getElementById("model-select");
  const model = modelSelect ? modelSelect.value : 'openai';
  formData.append("model", model);

  try {
    // Show upload started notification
    showNotification("Uploading and processing file...", "info");

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error(`Failed to upload file: ${response.statusText}`);

    const result = await response.json();

    // Hide loading indicator with fade out
    if (loadingIndicator) {
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";

        // Display results with animation
        displayResults(result);

        // Show success notification
        showNotification("File processed successfully!", "success");
      }, 400);
    }
  } catch (error) {
    // Hide loading indicator with fade out
    if (loadingIndicator) {
      loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        loadingIndicator.style.display = "none";
      }, 400);
    }

    console.error("Error:", error);
    showNotification(`Error: ${error.message}`, "error");
    
    // Clear the processing messages
    if (transcriptEl) transcriptEl.innerHTML = "No transcript available yet. Upload an audio file to get started.";
    if (insightsEl) insightsEl.innerHTML = "No insights available yet. Upload an audio file to get started.";
  }
}

/**
 * Show notification popup
 * @param {string} message - Notification text
 * @param {string} type - Notification type (info, success, warning, error)
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
    if (notification.parentNode) {
      notification.style.opacity = "0";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
}

/**
 * List all memos and display them in a sidebar
 */
async function listMemos() {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/memos`);
    if (!response.ok) {
      throw new Error(`Failed to fetch memos: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Create a memo list element if it doesn't exist
    let memoSidebar = document.getElementById('memo-sidebar');
    if (!memoSidebar) {
      // Create the sidebar
      memoSidebar = document.createElement('div');
      memoSidebar.id = 'memo-sidebar';
      memoSidebar.className = 'memo-sidebar';
      
      // Create the header
      const header = document.createElement('div');
      header.className = 'memo-sidebar-header';
      header.innerHTML = '<h3>Recent Memos</h3>';
      
      // Add refresh button
      const refreshBtn = document.createElement('button');
      refreshBtn.id = 'refresh-memos-btn';
      refreshBtn.innerHTML = '↻';
      refreshBtn.title = 'Refresh memos';
      refreshBtn.style.cssText = 'background: transparent; color: #6c757d; border: none; font-size: 16px; cursor: pointer; padding: 0 5px;';
      refreshBtn.addEventListener('click', listMemos);
      header.appendChild(refreshBtn);
      
      // Create the list container
      const memoListEl = document.createElement('div');
      memoListEl.id = 'memo-list';
      memoListEl.className = 'memo-list';
      
      // Append elements
      memoSidebar.appendChild(header);
      memoSidebar.appendChild(memoListEl);
      
      // Add sidebar to the container
      const container = document.querySelector('.container');
      if (container) {
        container.insertBefore(memoSidebar, container.firstChild);
      }
      
      // Add styles if not already added
      if (!document.getElementById('memo-sidebar-styles')) {
        const style = document.createElement('style');
        style.id = 'memo-sidebar-styles';
        style.textContent = `
          .memo-sidebar {
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 20px;
            padding: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          .memo-sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .memo-sidebar-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
          }
          .memo-list {
            max-height: 200px;
            overflow-y: auto;
          }
          .memo-item {
            padding: 8px 12px;
            background: white;
            border-radius: 4px;
            margin-bottom: 8px;
            cursor: pointer;
            border: 1px solid #eee;
            transition: all 0.2s ease;
            position: relative;
          }
          .memo-item:hover {
            background: #f0f0f0;
            transform: translateY(-2px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          .memo-item-title {
            font-weight: 500;
            margin-bottom: 3px;
            padding-right: 20px;
          }
          .memo-item-date {
            font-size: 12px;
            color: #6c757d;
          }
          .memo-item-status {
            display: inline-block;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: 5px;
          }
          .memo-item-status.completed {
            background: #d4edda;
            color: #155724;
          }
          .memo-item-status.processing {
            background: #cce5ff;
            color: #004085;
          }
          .memo-item-status.failed {
            background: #f8d7da;
            color: #721c24;
          }
          .no-memos {
            color: #6c757d;
            text-align: center;
            padding: 20px;
            font-style: italic;
          }
          .memo-delete-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: #dc3545;
            font-size: 14px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s ease;
            padding: 0;
            margin: 0;
            width: 20px;
            height: 20px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .memo-item:hover .memo-delete-btn {
            opacity: 0.7;
          }
          .memo-delete-btn:hover {
            opacity: 1 !important;
            transform: none;
          }
        `;
        document.head.appendChild(style);
      }
    }
    
    // Get or create the memo list
    let memoListEl = document.getElementById('memo-list');
    if (!memoListEl) {
      memoListEl = document.createElement('div');
      memoListEl.id = 'memo-list';
      memoListEl.className = 'memo-list';
      memoSidebar.appendChild(memoListEl);
    }
    
    // Clear previous content
    memoListEl.innerHTML = '';
    
    // If no memos found
    if (!data.results || data.results.length === 0) {
      memoListEl.innerHTML = '<div class="no-memos">No memos found</div>';
      return;
    }
    
    // Add each memo to the list
    data.results.forEach(memo => {
      const memoItem = document.createElement('div');
      memoItem.className = 'memo-item';
      memoItem.dataset.id = memo.id;
      
      // Format date
      const date = new Date(memo.created_at);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Create status badge
      const statusClass = memo.status === 'completed' ? 'completed' : 
                         memo.status === 'processing' ? 'processing' : 'failed';
      
      memoItem.innerHTML = `
        <div class="memo-item-title">${memo.title || 'Untitled Memo'}</div>
        <div class="memo-item-date">
          ${formattedDate}
          <span class="memo-item-status ${statusClass}">${memo.status}</span>
        </div>
        <button class="memo-delete-btn" title="Delete memo">×</button>
      `;
      
      // Add click event to load the memo
      memoItem.addEventListener('click', function(event) {
        // Don't trigger if the delete button was clicked
        if (event.target.classList.contains('memo-delete-btn')) {
          return;
        }
        loadMemo(memo.id);
      });
      
      // Add delete button functionality
      const deleteBtn = memoItem.querySelector('.memo-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function(event) {
          event.stopPropagation(); // Prevent memo loading
          deleteMemo(memo.id);
        });
      }
      
      memoListEl.appendChild(memoItem);
    });
  } catch (error) {
    console.error('Error loading memos:', error);
    showNotification(`Failed to load memos: ${error.message}`, 'error');
  }
}

/**
 * Load a specific memo by ID
 * @param {string} memoId - The ID of the memo to load
 */
async function loadMemo(memoId) {
  try {
    showNotification('Loading memo...', 'info');
    
    const response = await fetch(`${API_BASE_URL}/v1/memos/${memoId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch memo: ${response.statusText}`);
    }
    
    const memo = await response.json();
    
    // Display results
    displayResults({
      transcript: memo.transcript,
      insights: memo.insights,
      raw_insights: memo.raw_insights
    });
    
    showNotification('Memo loaded successfully', 'success');
  } catch (error) {
    console.error('Error loading memo:', error);
    showNotification(`Failed to load memo: ${error.message}`, 'error');
  }
}

/**
 * Delete a memo by ID
 * @param {string} memoId - The ID of the memo to delete
 */
async function deleteMemo(memoId) {
  if (!confirm('Are you sure you want to delete this memo?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/v1/memos/${memoId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete memo: ${response.statusText}`);
    }
    
    showNotification('Memo deleted successfully', 'success');
    
    // Refresh the memo list
    listMemos();
  } catch (error) {
    console.error('Error deleting memo:', error);
    showNotification(`Failed to delete memo: ${error.message}`, 'error');
  }
}

/**
 * Initialize the application
 */
function initializeApp() {
  console.log("[Client] Initializing app.js");

  // Initialize layout
  initializePaneLayout();

  // Perform server health check
  checkServerHealth();
  
  // Load memos list
  listMemos();
}

/**
 * Initialize pane layout with responsive behavior
 */
function initializePaneLayout() {
  const transcriptPane = document.getElementById("transcript-pane");
  const insightsPane = document.getElementById("insights-pane");
  const paneContainer = document.querySelector(".pane-container");
  const copyTranscriptBtn = document.getElementById("copy-transcript-btn");
  const copyInsightsBtn = document.getElementById("copy-insights-btn");

  if (!transcriptPane || !insightsPane || !paneContainer) {
    console.warn("[Client] Pane elements not found in DOM");
    return;
  }

  // Set initial button states based on pane collapsed status
  if (copyTranscriptBtn) {
    copyTranscriptBtn.classList.toggle(
      "disabled",
      transcriptPane.classList.contains("collapsed")
    );
  }

  if (copyInsightsBtn) {
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
 * Check server health
 */
async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    const data = await response.json();
    console.log("[Client] Server health check successful:", data);
  } catch (error) {
    console.warn("[Client] Server health check failed:", error);
    showNotification("Cannot connect to server. Please make sure the backend is running.", "error");
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
  const uploadBtn = document.getElementById("upload-button");
  const exportMarkdownBtn = document.getElementById("export-markdown");
  const exportObsidianBtn = document.getElementById("export-obsidian");
  const apiModeSelect = document.getElementById("api-mode");

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

  // API mode selection
  if (apiModeSelect) {
    apiModeSelect.addEventListener("change", () => {
      const useNewApi = apiModeSelect.value === "v1";
      console.log(`[Client] API mode changed to: ${useNewApi ? "New API (v1)" : "Legacy API"}`);
      
      // Enable or disable export buttons based on API mode
      if (exportMarkdownBtn) exportMarkdownBtn.disabled = !useNewApi;
      if (exportObsidianBtn) exportObsidianBtn.disabled = !useNewApi;
      
      // Update the upload button action
      if (uploadBtn) {
        uploadBtn.onclick = useNewApi ? uploadFile : uploadFileLegacy;
      }
    });
    
    // Trigger the change event to set initial state
    apiModeSelect.dispatchEvent(new Event('change'));
  }

  // Export buttons functionality
  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener("click", () => {
      const insightsEl = document.getElementById("insights");
      const transcriptEl = document.getElementById("transcript");
      
      if (!insightsEl || !transcriptEl) {
        showNotification("Required elements not found", "error");
        return;
      }
      
      const insights = insightsEl.getAttribute("data-markdown");
      const transcript = transcriptEl.innerText;
      
      if (!insights || !transcript || 
          transcript === "No transcript available yet. Upload an audio file to get started.") {
        showNotification("No content to export", "warning");
        return;
      }
      
      const markdown = `# Voice Memo Transcript\n\n## Transcript\n\n${transcript}\n\n## Insights\n\n${insights}`;
      
      // Create a temporary link to download the file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voice-memo-${new Date().toISOString().slice(0, 10)}.md`;
      link.click();
      URL.revokeObjectURL(url);
      
      showNotification("Markdown file downloaded", "success");
    });
  }
  
  if (exportObsidianBtn) {
    exportObsidianBtn.addEventListener("click", () => {
      const insightsEl = document.getElementById("insights");
      const transcriptEl = document.getElementById("transcript");
      
      if (!insightsEl || !transcriptEl) {
        showNotification("Required elements not found", "error");
        return;
      }
      
      const insights = insightsEl.getAttribute("data-markdown");
      const transcript = transcriptEl.innerText;
      
      if (!insights || !transcript || 
          transcript === "No transcript available yet. Upload an audio file to get started.") {
        showNotification("No content to export", "warning");
        return;
      }
      
      // Create Obsidian URI
      const markdown = `# Voice Memo Transcript\n\n## Transcript\n\n${transcript}\n\n## Insights\n\n${insights}`;
      const fileName = `Voice Memo ${new Date().toISOString().slice(0, 10)}`;
      const encodedContent = encodeURIComponent(markdown);
      const obsidianUrl = `obsidian://new?vault=VoiceMemos&name=${encodeURIComponent(fileName)}&content=${encodedContent}`;
      
      // Open the URI
      window.open(obsidianUrl, '_blank');
      
      showNotification("Opening in Obsidian...", "info");
    });
  }

  // Copy insights to clipboard functionality
  if (copyInsightsBtn) {
    copyInsightsBtn.addEventListener("click", () => {
      // Check if button is disabled
      if (copyInsightsBtn.classList.contains("disabled")) {
        return; // Exit the function early if disabled
      }

      const insightsElement = document.getElementById("insights");
      if (!insightsElement) {
        showNotification("Insights element not found", "error");
        return;
      }
      
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
          
          showNotification("Insights copied to clipboard", "success");
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
          showNotification("Failed to copy to clipboard", "error");
        });
    });
  }

  // Copy transcript to clipboard functionality
  if (copyTranscriptBtn) {
    copyTranscriptBtn.addEventListener("click", () => {
      // Check if button is disabled
      if (copyTranscriptBtn.classList.contains("disabled")) {
        return; // Exit the function early if disabled
      }

      const transcriptElement = document.getElementById("transcript");
      if (!transcriptElement) {
        showNotification("Transcript element not found", "error");
        return;
      }
      
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
          
          showNotification("Transcript copied to clipboard", "success");
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
          showNotification("Failed to copy to clipboard", "error");
        });
    });
  }

  // Connect browse button to hidden file input
  if (browseButton && uploadButton) {
    browseButton.addEventListener("click", () => {
      uploadButton.click();
    });
  }

  // Update text field when file is selected
  if (uploadButton && filePathInput) {
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
        
        // Enable export buttons when we have a file selected (only for new API mode)
        if (apiModeSelect && apiModeSelect.value === "v1") {
          if (exportMarkdownBtn) exportMarkdownBtn.disabled = false;
          if (exportObsidianBtn) exportObsidianBtn.disabled = false;
        }
      } else {
        filePathInput.value = "";
      }
    });
  }

  // Set default upload handler based on API mode
  const useNewApi = apiModeSelect ? apiModeSelect.value === "v1" : true;
  if (uploadBtn) {
    uploadBtn.onclick = useNewApi ? uploadFile : uploadFileLegacy;
  }

  // Make the utility functions accessible from HTML
  window.uploadFile = uploadFile;
  window.uploadFileLegacy = uploadFileLegacy;
  window.togglePane = togglePane;
  window.highlightTranscript = highlightTranscript;
  window.loadMemo = loadMemo;
  window.deleteMemo = deleteMemo;
  window.listMemos = listMemos;
});

// Export functions for testing (only in Node.js environment)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    displayResults,
    togglePane,
    highlightTranscript,
    uploadFile,
    uploadFileLegacy,
    showNotification,
    initializeApp,
    initializePaneLayout,
    checkServerHealth,
    listMemos,
    loadMemo,
    deleteMemo,
    formatStructuredInsights
  };
}