
const scanBtn = document.getElementById("scanBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

scanBtn.addEventListener("click", async () => {
  result.replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Scanning current page...";
  result.appendChild(loading);

  scanBtn.disabled = true;

  try {
    const tab = await getCurrentTab();

    if (!tab?.id || !tab.url?.startsWith("http") &&
        !tab.url?.startsWith("file:")) {
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

    const heading = document.createElement("p");

    heading.textContent =
      `Found ${response.count} potential issue(s).`;

    result.appendChild(heading);

    if (response.count === 0) {
      const message = document.createElement("p");

      message.textContent =
        "No suspicious elements detected by these checks. " +
        "This does not guarantee that the website is safe.";

      result.appendChild(message);
    }

    response.findings.forEach((finding, index) => {
      const card = document.createElement("div");
      card.className = "finding";

      const title = document.createElement("strong");

      title.textContent =
        `${index + 1}. ${finding.description}`;

      const details = document.createElement("small");

      details.textContent =
        finding.reasons.join(" · ");

      card.append(title, details);
      result.appendChild(card);
    });
  } catch (error) {
    result.replaceChildren();

    const message = document.createElement("p");

    message.textContent =
      error.message ||
      "Could not scan this page. Reload the website and try again.";

    result.appendChild(message);
  } finally {
    scanBtn.disabled = false;
  }
});

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
  } catch {
    result.textContent =
      "Reload the page to remove any remaining highlights.";
  }
});