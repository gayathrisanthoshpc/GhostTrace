
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");

const filterSection = document.getElementById("filterSection");
const filterButtons = document.querySelectorAll(".filter-btn");

const HISTORY_KEY = "ghostTraceScanHistory";
const MAX_HISTORY = 5;

let currentFindings = [];
let currentFilter = "All";

// ------------------------------
// CURRENT TAB
// ------------------------------

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

// ------------------------------
// RISK COLORS
// ------------------------------

function getRiskColor(level) {
  switch (level) {
    case "High":
      return "#dc2626";
    case "Medium":
      return "#d97706";
    case "Low":
      return "#16a34a";
    default:
      return "#64748b";
  }
}

// ------------------------------
// SUMMARY
// ------------------------------

function createSummaryCard(label, count, color) {
  const card = document.createElement("div");

  Object.assign(card.style, {
    flex: "1",
    minWidth: "65px",
    padding: "12px 6px",
    textAlign: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxSizing: "border-box"
  });

  const number = document.createElement("div");
  number.textContent = count;

  Object.assign(number.style, {
    fontSize: "24px",
    fontWeight: "bold",
    color,
    marginBottom: "4px"
  });

  const title = document.createElement("div");
  title.textContent = label;

  Object.assign(title.style, {
    fontSize: "12px",
    fontWeight: "600",
    color: "#475569"
  });

  card.append(number, title);

  return card;
}

function displaySummary(findings) {
  const highCount = findings.filter(
    finding => finding.riskLevel === "High"
  ).length;

  const mediumCount = findings.filter(
    finding => finding.riskLevel === "Medium"
  ).length;

  const lowCount = findings.filter(
    finding => finding.riskLevel === "Low"
  ).length;

  const summary = document.createElement("div");
  summary.id = "scanSummary";

  Object.assign(summary.style, {
    margin: "12px 0 16px",
    padding: "14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px"
  });

  const heading = document.createElement("h3");
  heading.textContent = "Scan Summary";

  Object.assign(heading.style, {
    margin: "0 0 12px",
    fontSize: "16px",
    color: "#0f172a"
  });

  summary.appendChild(heading);

  const totalCard = createSummaryCard(
    "Total Issues",
    findings.length,
    "#334155"
  );

  totalCard.style.marginBottom = "10px";
  summary.appendChild(totalCard);

  const riskCards = document.createElement("div");

  Object.assign(riskCards.style, {
    display: "flex",
    gap: "8px",
    width: "100%"
  });

  riskCards.append(
    createSummaryCard("High", highCount, getRiskColor("High")),
    createSummaryCard("Medium", mediumCount, getRiskColor("Medium")),
    createSummaryCard("Low", lowCount, getRiskColor("Low"))
  );

  summary.appendChild(riskCards);

  const message = document.createElement("p");

  if (highCount > 0) {
    message.textContent =
      "High-risk indicators detected. Review these elements carefully.";
    message.style.color = "#b91c1c";
  } else if (mediumCount > 0) {
    message.textContent =
      "Some suspicious indicators were detected. Review the flagged elements.";
    message.style.color = "#b45309";
  } else if (lowCount > 0) {
    message.textContent =
      "Only low-risk indicators were detected. Review the findings for context.";
    message.style.color = "#15803d";
  } else {
    message.textContent =
      "No suspicious elements detected by these checks. This does not guarantee that the website is safe.";
    message.style.color = "#475569";
  }

  Object.assign(message.style, {
    margin: "12px 0 0",
    fontSize: "12px",
    lineHeight: "1.5"
  });

  summary.appendChild(message);
  result.appendChild(summary);
}

// ------------------------------
// SCAN HISTORY
// ------------------------------

function getScanHistory() {
  try {
    const history = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    );

    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function saveScanHistory(tab, findings) {
  const history = getScanHistory();

  let website = "Unknown website";

  try {
    website = new URL(tab.url).hostname;
  } catch {
    website = tab.title || "Unknown website";
  }

  const highCount = findings.filter(
    finding => finding.riskLevel === "High"
  ).length;

  const mediumCount = findings.filter(
    finding => finding.riskLevel === "Medium"
  ).length;

  const lowCount = findings.filter(
    finding => finding.riskLevel === "Low"
  ).length;

  const scanRecord = {
    website,
    scannedAt: new Date().toISOString(),
    total: findings.length,
    high: highCount,
    medium: mediumCount,
    low: lowCount
  };

  history.unshift(scanRecord);

  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY))
    );
  } catch (error) {
    console.error("Could not save scan history:", error);
  }
}

function renderHistory() {
  // Remove the old history section before rendering a new one.
  const oldSection = document.getElementById("historySection");

  if (oldSection) {
    oldSection.remove();
  }

  const history = getScanHistory();

  const section = document.createElement("div");
  section.id = "historySection";

  Object.assign(section.style, {
    margin: "16px 0",
    padding: "14px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px"
  });

  const header = document.createElement("div");

  Object.assign(header.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px"
  });

  const heading = document.createElement("h3");
  heading.textContent = "Scan History";

  Object.assign(heading.style, {
    margin: "0",
    fontSize: "16px",
    color: "#0f172a"
  });

  header.appendChild(heading);

  if (history.length > 0) {
    const clearHistoryBtn = document.createElement("button");

    clearHistoryBtn.textContent = "Clear";

    Object.assign(clearHistoryBtn.style, {
      width: "auto",
      border: "none",
      background: "#fee2e2",
      color: "#b91c1c",
      padding: "5px 9px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "600"
    });

    clearHistoryBtn.addEventListener("click", () => {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    });

    header.appendChild(clearHistoryBtn);
  }

  section.appendChild(header);

  if (history.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.textContent =
      "No scans yet. Scan a webpage to see your history here.";

    Object.assign(emptyMessage.style, {
      fontSize: "13px",
      color: "#64748b",
      lineHeight: "1.5",
      margin: "0"
    });

    section.appendChild(emptyMessage);
  } else {
    history.forEach((item, index) => {
      const card = document.createElement("div");

      Object.assign(card.style, {
        padding: "10px",
        marginBottom:
          index === history.length - 1 ? "0" : "8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px"
      });

      const website = document.createElement("strong");
      website.textContent = item.website;

      Object.assign(website.style, {
        display: "block",
        fontSize: "13px",
        color: "#0f172a",
        overflowWrap: "anywhere"
      });

      const time = document.createElement("p");
      time.textContent = new Date(
        item.scannedAt
      ).toLocaleString();

      Object.assign(time.style, {
        fontSize: "11px",
        color: "#64748b",
        margin: "5px 0 8px"
      });

      const count = document.createElement("p");

      count.textContent =
        `${item.total} issue(s) · ` +
        `High: ${item.high} · ` +
        `Medium: ${item.medium} · ` +
        `Low: ${item.low}`;

      Object.assign(count.style, {
        fontSize: "12px",
        color: "#475569",
        margin: "0",
        lineHeight: "1.5"
      });

      card.append(website, time, count);
      section.appendChild(card);
    });
  }

  result.appendChild(section);
}

// ------------------------------
// REUSABLE EXPLANATION SECTION
// ------------------------------

function createExplanationSection(title, text, color) {
  const section = document.createElement("div");

  Object.assign(section.style, {
    marginTop: "10px",
    padding: "10px",
    background: "#f8fafc",
    borderLeft: `3px solid ${color}`,
    borderRadius: "5px"
  });

  const heading = document.createElement("strong");
  heading.textContent = title;

  Object.assign(heading.style, {
    display: "block",
    fontSize: "12px",
    color,
    marginBottom: "5px"
  });

  const description = document.createElement("p");

  description.textContent =
    text || "No additional details available.";

  Object.assign(description.style, {
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#334155",
    margin: "0",
    overflowWrap: "anywhere"
  });

  section.append(heading, description);

  return section;
}

// ------------------------------
// ELEMENT DETAILS
// ------------------------------

// Display the type, label, and destination of the flagged element.
function createElementDetailsSection(finding) {
  const section = document.createElement("div");

  Object.assign(section.style, {
    marginTop: "10px",
    padding: "10px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: "8px"
  });

  const heading = document.createElement("strong");
  heading.textContent = "Element Details";

  Object.assign(heading.style, {
    display: "block",
    fontSize: "12px",
    color: "#0f172a",
    marginBottom: "8px"
  });

  section.appendChild(heading);

  // Add one labeled row for each detail.
  function addDetail(label, value) {
    const row = document.createElement("div");

    Object.assign(row.style, {
      marginBottom: "7px",
      fontSize: "12px",
      lineHeight: "1.5",
      overflowWrap: "anywhere"
    });

    const detailLabel = document.createElement("strong");
    detailLabel.textContent = `${label}: `;

    Object.assign(detailLabel.style, {
      color: "#334155"
    });

    const detailValue = document.createElement("span");
    detailValue.textContent = value;

    Object.assign(detailValue.style, {
      color: "#475569",
      overflowWrap: "anywhere"
    });

    row.append(detailLabel, detailValue);

    section.appendChild(row);
  }

  const elementType = finding.elementType || "Unknown";
  const elementLabel = finding.elementLabel || "No label available";
  const destination = finding.destination || "";

  addDetail("Type", elementType);
  addDetail("Label", elementLabel);

  if (destination) {
    addDetail("Destination", destination);
  } else {
    addDetail("Destination", "No destination available");
  }

  // Explain that the details describe the element,
  // not whether the destination is definitely malicious.
  const note = document.createElement("p");

  note.textContent =
    "These details identify the flagged element. A destination or label alone does not prove that a website is malicious.";

  Object.assign(note.style, {
    fontSize: "11px",
    lineHeight: "1.5",
    color: "#64748b",
    margin: "6px 0 0"
  });

  section.appendChild(note);

  return section;
}

// ------------------------------
// LOCATE ELEMENT
// ------------------------------

// Build the Locate Element action for one finding card.
function createLocateAction(finding) {
  const container = document.createElement("div");

  Object.assign(container.style, {
    marginTop: "10px"
  });

  const locateButton = document.createElement("button");

  locateButton.type = "button";
  locateButton.textContent = "Locate Element";

  Object.assign(locateButton.style, {
    padding: "8px 12px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600"
  });

  const locateStatus = document.createElement("p");

  Object.assign(locateStatus.style, {
    margin: "8px 0 0",
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#64748b"
  });

  locateButton.addEventListener("click", async () => {
    locateButton.disabled = true;
    locateStatus.textContent = "Locating element…";
    locateStatus.style.color = "#64748b";

    try {
      const tab = await getCurrentTab();

      if (!tab?.id) {
        throw new Error("No active tab.");
      }

      const response = await chrome.tabs.sendMessage(
        tab.id,
        {
          action: "LOCATE_ELEMENT",
          elementId: finding.elementId
        }
      );

      if (response?.success) {
        locateStatus.textContent =
          "Element located on the page.";

        locateStatus.style.color = "#15803d";
      } else {
        // The element was removed from the page, or the
        // mapping no longer contains it. A rescan fixes both.
        locateStatus.textContent =
          "This element is no longer on the page. Scan again to update findings.";

        locateStatus.style.color = "#b45309";
      }
    } catch {
      // Messaging failed, e.g. the page was reloaded and
      // the content script is no longer there.
      locateStatus.textContent =
        "Could not reach this page. Reload it, then scan again.";

      locateStatus.style.color = "#b91c1c";
    } finally {
      locateButton.disabled = false;
    }
  });

  container.append(locateButton, locateStatus);

  return container;
}

// ------------------------------
// FINDING CARD
// ------------------------------

function createFindingCard(finding, index) {
  const card = document.createElement("div");
  card.className = "finding";

  Object.assign(card.style, {
    marginBottom: "12px",
    padding: "12px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#ffffff"
  });

  const title = document.createElement("strong");

  title.textContent =
    `${index + 1}. ${finding.description || "Potential issue detected"}`;

  Object.assign(title.style, {
    display: "block",
    fontSize: "14px",
    lineHeight: "1.5",
    color: "#0f172a",
    overflowWrap: "anywhere"
  });

  const riskLevel = finding.riskLevel || "Unknown";
  const riskScore = finding.riskScore ?? 0;

  const riskBadge = document.createElement("span");
  riskBadge.className = "risk-badge";

  riskBadge.textContent =
    `${riskLevel} Risk · ${riskScore}/100`;

  if (riskLevel === "High") {
    riskBadge.classList.add("risk-high");
  } else if (riskLevel === "Medium") {
    riskBadge.classList.add("risk-medium");
  } else if (riskLevel === "Low") {
    riskBadge.classList.add("risk-low");
  }

  // Why flagged
  const reasons = document.createElement("div");

  Object.assign(reasons.style, {
    marginTop: "10px"
  });

  const reasonsHeading = document.createElement("strong");
  reasonsHeading.textContent = "Why flagged";

  Object.assign(reasonsHeading.style, {
    display: "block",
    fontSize: "12px",
    color: "#334155",
    marginBottom: "5px"
  });

  const reasonsList = document.createElement("ul");

  Object.assign(reasonsList.style, {
    paddingLeft: "18px",
    margin: "0",
    fontSize: "12px",
    lineHeight: "1.6",
    color: "#475569"
  });

  const findingReasons = Array.isArray(finding.reasons)
    ? finding.reasons
    : [];

  if (findingReasons.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No specific reasons provided.";
    reasonsList.appendChild(item);
  } else {
    findingReasons.forEach(reason => {
      const item = document.createElement("li");
      item.textContent = reason;
      reasonsList.appendChild(item);
    });
  }

  reasons.append(reasonsHeading, reasonsList);

  // New: element details
  const elementDetails = createElementDetailsSection(finding);

  // Existing explanations
  const explanationSection = createExplanationSection(
    "What it means",
    finding.explanation,
    "#2563eb"
  );

  const recommendationSection = createExplanationSection(
    "What to check",
    finding.recommendation,
    "#0f766e"
  );

  card.append(
    title,
    riskBadge,
    elementDetails,
    reasons,
    explanationSection,
    recommendationSection
  );

  // Locate Element action (only when the finding
  // carries an elementId from the content script).
  if (finding.elementId) {
    card.append(createLocateAction(finding));
  }

  return card;
}

// ------------------------------
// SEVERITY FILTERING
// ------------------------------

function updateFilterButtons() {
  filterButtons.forEach(button => {
    const isActive = button.dataset.filter === currentFilter;

    button.classList.toggle("active", isActive);

    button.setAttribute(
      "aria-pressed",
      String(isActive)
    );
  });
}

// Render the filtered findings in a dedicated container.
// This prevents filtering from deleting the summary or history.
function renderFilteredFindings() {
  const findingsContainer = document.getElementById(
    "findingsContainer"
  );

  if (!findingsContainer) {
    return;
  }

  findingsContainer.replaceChildren();

  const filteredFindings = currentFilter === "All"
    ? currentFindings
    : currentFindings.filter(
        finding => finding.riskLevel === currentFilter
      );

  const countMessage = document.createElement("p");

  countMessage.className = "filter-count";

  countMessage.textContent =
    `Showing ${filteredFindings.length} of ${currentFindings.length} finding(s)`;

  Object.assign(countMessage.style, {
    margin: "0 0 10px",
    fontSize: "12px",
    color: "#aab5cc"
  });

  findingsContainer.appendChild(countMessage);

  if (filteredFindings.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "filter-empty";

    emptyMessage.textContent = currentFilter === "All"
      ? "No findings to display."
      : `No ${currentFilter.toLowerCase()}-risk findings were detected.`;

    Object.assign(emptyMessage.style, {
      padding: "12px",
      background: "#141b2e",
      borderRadius: "8px",
      fontSize: "12px",
      lineHeight: "1.5",
      color: "#aab5cc"
    });

    findingsContainer.appendChild(emptyMessage);
    return;
  }

  filteredFindings.forEach((finding, index) => {
    const card = createFindingCard(finding, index);
    findingsContainer.appendChild(card);
  });
}

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    updateFilterButtons();
    renderFilteredFindings();
  });
});

// ------------------------------
// SCAN CURRENT PAGE
// ------------------------------

scanBtn.addEventListener("click", async () => {
  result.replaceChildren();

  currentFindings = [];
  currentFilter = "All";

  filterSection.hidden = true;
  updateFilterButtons();

  const loading = document.createElement("p");
  loading.textContent = "Scanning current page.";

  result.appendChild(loading);

  scanBtn.disabled = true;

  try {
    const tab = await getCurrentTab();

    if (
      !tab?.id ||
      (
        !tab.url?.startsWith("http") &&
        !tab.url?.startsWith("file:")
      )
    ) {
      throw new Error(
        "Open a supported webpage before scanning."
      );
    }

    const response = await chrome.tabs.sendMessage(
      tab.id,
      {
        action: "SCAN_PAGE"
      }
    );

    result.replaceChildren();

    currentFindings = response?.findings || [];

    // Save the scan to local history.
    saveScanHistory(tab, currentFindings);

    const heading = document.createElement("p");

    heading.textContent =
      `Found ${currentFindings.length} potential issue(s).`;

    result.appendChild(heading);

    // Summary always reflects the complete scan.
    displaySummary(currentFindings);

    // Create a dedicated findings container.
    const findingsContainer = document.createElement("div");
    findingsContainer.id = "findingsContainer";

    result.appendChild(findingsContainer);

    filterSection.hidden = false;

    updateFilterButtons();
    renderFilteredFindings();

    // Render history after findings.
    renderHistory();

  } catch (error) {
    result.replaceChildren();

    const message = document.createElement("p");

    message.textContent =
      error.message ||
      "Could not scan this page. Reload the website and try again.";

    result.appendChild(message);

    renderHistory();

  } finally {
    scanBtn.disabled = false;
  }
});

// ------------------------------
// CLEAR HIGHLIGHTS
// ------------------------------

clearBtn.addEventListener("click", async () => {
  try {
    const tab = await getCurrentTab();

    if (tab?.id) {
      await chrome.tabs.sendMessage(
        tab.id,
        {
          action: "CLEAR_HIGHLIGHTS"
        }
      );
    }

    result.replaceChildren();

    currentFindings = [];
    currentFilter = "All";

    filterSection.hidden = true;
    updateFilterButtons();

    const message = document.createElement("p");
    message.textContent = "Highlights cleared.";

    result.appendChild(message);

    renderHistory();

  } catch {
    result.replaceChildren();

    const message = document.createElement("p");

    message.textContent =
      "Reload the page to remove any remaining highlights.";

    result.appendChild(message);

    renderHistory();
  }
});

// ------------------------------
// INITIALIZE POPUP
// ------------------------------

renderHistory();