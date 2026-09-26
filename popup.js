
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");

const HISTORY_KEY = "ghostTraceScanHistory";
const MAX_HISTORY = 5;

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

// Get saved history from local browser storage.
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

// Save a new scan to history.
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
    website: website,
    scannedAt: new Date().toISOString(),
    total: findings.length,
    high: highCount,
    medium: mediumCount,
    low: lowCount
  };

  // Add newest scan first and keep only five.
  history.unshift(scanRecord);

  const updatedHistory = history.slice(0, MAX_HISTORY);

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(updatedHistory)
  );
}

// Display the saved scan history.
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
// SCAN CURRENT PAGE
// ------------------------------

scanBtn.addEventListener("click", async () => {
  result.replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Scanning current page...";
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

    const findings = response.findings || [];

    // Save this scan in local history.
    saveScanHistory(tab, findings);

    const heading = document.createElement("p");

    heading.textContent =
      `Found ${response.count} potential issue(s).`;

    result.appendChild(heading);

    // Display the existing risk summary.
    displaySummary(findings);

    // Display individual findings.
    findings.forEach((finding, index) => {
      const card = document.createElement("div");
      card.className = "finding";

      const title = document.createElement("strong");

      title.textContent =
        `${index + 1}. ${finding.description}`;

      const riskBadge = document.createElement("span");

      const riskLevel = finding.riskLevel || "Unknown";
      const riskScore = finding.riskScore ?? 0;

      riskBadge.textContent =
        `${riskLevel} Risk · ${riskScore}/100`;

      Object.assign(riskBadge.style, {
        display: "inline-block",
        marginTop: "8px",
        marginBottom: "8px",
        padding: "4px 8px",
        borderRadius: "12px",
        backgroundColor: getRiskColor(riskLevel),
        color: "#ffffff",
        fontSize: "12px",
        fontWeight: "bold"
      });

      const details = document.createElement("small");

      details.textContent =
        (finding.reasons || []).join(" · ");

      card.append(
        title,
        document.createElement("br"),
        riskBadge,
        document.createElement("br"),
        details
      );

      result.appendChild(card);
    });

    // Show updated history below the findings.
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