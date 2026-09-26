
(() => {
  // Prevent the scanner from being installed more than once.
  if (window.__ghostTraceInstalled) {
    return;
  }

  window.__ghostTraceInstalled = true;

  const HIGHLIGHT_LAYER_ID =
    "__ghosttrace_highlight_layer";

  // Elements that users can potentially interact with.
  const selector = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[onclick]",
    "[tabindex]"
  ].join(",");

  // Check whether two rectangles overlap.
  function rectanglesOverlap(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  // Assign a risk level based on suspicious behaviour.
  function calculateRisk(reasons) {
    let score = 0;

    for (const reason of reasons) {
      if (
        reason ===
        "Interactive element has very low opacity"
      ) {
        score += 40;
      }

      if (
        reason ===
        "Interactive element is unusually small"
      ) {
        score += 20;
      }

      if (
        reason ===
        "Large, nearly invisible interactive element"
      ) {
        score += 30;
      }

      if (
        reason ===
        "Overlaps another visible interactive target"
      ) {
        score += 40;
      }
    }

    // Keep the score within 0–100.
    score = Math.min(score, 100);

    let level = "Low";

    if (score >= 70) {
      level = "High";
    } else if (score >= 40) {
      level = "Medium";
    }

    return {
      score,
      level
    };
  }

  function scanPage() {
    const elements = [
      ...document.querySelectorAll(selector)
    ];

    const findings = [];
    const visibleTargets = [];

    for (const el of elements) {
      // Ignore elements created by GhostTrace.
      if (el.closest(`#${HIGHLIGHT_LAYER_ID}`)) {
        continue;
      }

      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      // Ignore elements that are not rendered.
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        continue;
      }

      const opacity = Number(style.opacity);

      // Is the element almost invisible?
      const nearlyInvisible = opacity < 0.1;

      // Is the element unusually small?
      const unusuallySmall =
        rect.width < 8 ||
        rect.height < 8;

      // Is the element visually large?
      const isLarge =
        rect.width * rect.height >
        window.innerWidth *
          window.innerHeight *
          0.25;

      // Record visible, reasonably sized targets
      // for overlap comparisons.
      if (!nearlyInvisible && !unusuallySmall) {
        visibleTargets.push({
          element: el,
          rect
        });
      }

      const reasons = [];

      if (nearlyInvisible) {
        reasons.push(
          "Interactive element has very low opacity"
        );
      }

      if (unusuallySmall) {
        reasons.push(
          "Interactive element is unusually small"
        );
      }

      if (nearlyInvisible && isLarge) {
        reasons.push(
          "Large, nearly invisible interactive element"
        );
      }

      if (reasons.length > 0) {
        const description =
          el.innerText?.trim().slice(0, 80) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.tagName.toLowerCase();

        findings.push({
          element: el,
          description,
          reasons,
          rect
        });
      }
    }

    // Compare suspicious elements with visible targets.
    for (const finding of findings) {
      const overlaps = visibleTargets.some(
        ({ element, rect }) => {
          if (element === finding.element) {
            return false;
          }

          return rectanglesOverlap(
            finding.rect,
            rect
          );
        }
      );

      if (overlaps) {
        finding.reasons.push(
          "Overlaps another visible interactive target"
        );
      }

      // Calculate the risk after all reasons are added.
      const risk = calculateRisk(finding.reasons);

      finding.riskScore = risk.score;
      finding.riskLevel = risk.level;
    }

    return findings;
  }

  // Remove the previous GhostTrace highlight layer.
  function clearHighlights() {
    const existingLayer =
      document.getElementById(
        HIGHLIGHT_LAYER_ID
      );

    if (existingLayer) {
      existingLayer.remove();
    }
  }

  // Draw visible highlight boxes and risk labels.
  function highlightFindings(findings) {
    clearHighlights();

    if (findings.length === 0) {
      return;
    }

    const layer = document.createElement("div");

    layer.id = HIGHLIGHT_LAYER_ID;

    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "2147483647",
      pointerEvents: "none",
      overflow: "hidden"
    });

    for (const finding of findings) {
      const {
        rect,
        description,
        reasons,
        riskLevel,
        riskScore
      } = finding;

      // Create the red highlight box.
      const box = document.createElement("div");

      Object.assign(box.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        boxSizing: "border-box",
        border: "3px solid #ff3b30",
        background: "rgba(255, 59, 48, 0.18)",
        borderRadius: "3px",
        pointerEvents: "none"
      });

      // Create the risk label.
      const label = document.createElement("div");

      label.textContent =
        `GhostTrace: ${riskLevel} Risk (${riskScore}/100)`;

      Object.assign(label.style, {
        position: "fixed",
        left: `${Math.max(0, rect.left)}px`,
        top: `${Math.max(0, rect.top - 30)}px`,
        maxWidth: "280px",
        padding: "5px 9px",
        background: "#ff3b30",
        color: "#ffffff",
        font: "bold 12px Arial, sans-serif",
        lineHeight: "16px",
        borderRadius: "4px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        pointerEvents: "none"
      });

      label.title =
        `${description}\n\n${reasons.join("\n")}`;

      box.appendChild(label);
      layer.appendChild(box);
    }

    document.documentElement.appendChild(layer);
  }

  // Listen for messages from the extension popup.
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message.action === "SCAN_PAGE") {
        const findings = scanPage();

        highlightFindings(findings);

        // Send plain data to the popup.
        sendResponse({
          count: findings.length,

          findings: findings.map(
            ({
              description,
              reasons,
              rect,
              riskLevel,
              riskScore
            }) => ({
              description,
              reasons,
              riskLevel,
              riskScore,

              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              }
            })
          )
        });
      }

      if (message.action === "CLEAR_HIGHLIGHTS") {
        clearHighlights();

        sendResponse({
          success: true
        });
      }

      return true;
    }
  );
})();