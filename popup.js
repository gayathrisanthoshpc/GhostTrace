
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");

const filterSection = document.getElementById("filterSection");
const filterButtons = document.querySelectorAll(".filter-btn");

const HISTORY_KEY = "ghostTraceScanHistory";
const MAX_HISTORY = 5;

// Store the current scan and selected filter.
let currentFindings = [];
let currentFilter = "All";

// Get the currently active Chrome tab.
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

// Get the color for each risk level.
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

// Create a reusable summary card.
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
    color: color,
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

// Display the scan summary.
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

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY))
  );
}

function renderHistory() {
  const history = getScanHistory();

  const section = document.createElement("div");

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
// EXPLAINABLE FINDINGS
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
    color: color,
    marginBottom: "5px"
  });

  const description = document.createElement("p");
  description.textContent = text || "No additional details available.";

  Object.assign(description.style, {
    fontSize: "12px",
    lineHeight: "1.5",
    color: "#334155",
    margin: "0"
  });

  section.append(heading, description);

  return section;
}

// Create a complete finding card.
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
    `${index + 1}. ${finding.description}`;

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

  const reasons = document.createElement("div");

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

  (finding.reasons || []).forEach(reason => {
    const item = document.createElement("li");
    item.textContent = reason;
    reasonsList.appendChild(item);
  });

  reasons.append(reasonsHeading, reasonsList);

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
    reasons,
    explanationSection,
    recommendationSection
  );

  return card;
}

// ------------------------------
// SEVERITY FILTERING
// ------------------------------

// Update the selected filter button.
function updateFilterButtons() {
  filterButtons.forEach(button => {
    const isActive = button.dataset.filter === currentFilter;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

// Display findings matching the selected risk level.
function renderFilteredFindings() {
  // Remove the old finding cards but preserve the summary and history.
  const oldCards = result.querySelectorAll(".finding");
  oldCards.forEach(card => card.remove());

  const filteredFindings = currentFilter === "All"
    ? currentFindings
    : currentFindings.filter(
        finding => finding.riskLevel === currentFilter
      );

  // Show how many findings match the current filter.
  const countMessage = document.createElement("p");

  countMessage.className = "filter-count";

  countMessage.textContent =
    `Showing ${filteredFindings.length} of ${currentFindings.length} finding(s)`;

  Object.assign(countMessage.style, {
    margin: "0 0 10px",
    fontSize: "12px",
    color: "#aab5cc"
  });

  // Remove any previous count message.
  const oldCount = result.querySelector(".filter-count");
  if (oldCount) {
    oldCount.remove();
  }

  // Insert the count before the finding cards.
  const historySection = result.querySelector(
    ":scope > div:last-child"
  );

  // Find a stable insertion point after the summary.
  const summary = result.querySelector(
    ":scope > div"
  );

  if (summary) {
    result.insertBefore(countMessage, summary.nextSibling);
  } else {
    result.prepend(countMessage);
  }

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

    result.insertBefore(
      emptyMessage,
      countMessage.nextSibling
    );
  } else {
    filteredFindings.forEach((finding, index) => {
      const card = createFindingCard(finding, index);

      result.insertBefore(
        card,
        countMessage.nextSibling
      );

      // Keep cards in the correct order.
      countMessage.after(card);
    });
  }

  // Keep the scan summary and history visible.
  if (historySection && historySection !== summary) {
    // History is retained in the result container.
  }
}

// Connect filter buttons.
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

    currentFindings = response.findings || [];

    // Save this scan in local history.
    saveScanHistory(tab, currentFindings);

    const heading = document.createElement("p");

    heading.textContent =
      `Found ${response.count} potential issue(s).`;

    result.appendChild(heading);

    // Display the summary for the complete scan.
    displaySummary(currentFindings);

    // Show filters after a successful scan.
    filterSection.hidden = false;

    updateFilterButtons();

    // Render all findings initially.
    renderFilteredFindings();

    // Display updated history.
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

// Show saved history whenever the popup opens.
renderHistory();