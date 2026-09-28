
(() => {
  // Prevent the scanner from being installed more than once.
  if (window.__ghostTraceInstalled) {
    return;
  }

  window.__ghostTraceInstalled = true;

  const HIGHLIGHT_LAYER_ID =
    "__ghosttrace_highlight_layer";

  const LOCATE_LAYER_ID =
    "__ghosttrace_locate_layer";

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

  // Explain each detection rule in simple language.
  const explanations = {
    "Interactive element has very low opacity": {
      meaning:
        "This element is almost transparent but can still be interactive. " +
        "It may be hidden visually while remaining clickable.",

      recommendation:
        "Check whether the element is intentionally transparent or is " +
        "covering another part of the page."
    },

    "Interactive element is unusually small": {
      meaning:
        "This interactive element is smaller than expected and may be " +
        "difficult to notice or click.",

      recommendation:
        "Check whether it is a legitimate small control or an unexpected " +
        "clickable target."
    },

    "Large, nearly invisible interactive element": {
      meaning:
        "This element covers a large part of the page while having " +
        "very low opacity. It could potentially intercept user clicks.",

      recommendation:
        "Inspect its position and purpose. Check whether it sits over " +
        "visible content or important buttons."
    },

    "Overlaps another visible interactive target": {
      meaning:
        "This element overlaps a different visible interactive element. " +
        "It could potentially interfere with the user's intended click.",

      recommendation:
        "Check which element receives the click and whether the overlap " +
        "is expected."
    }
  };

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

  // Generate plain-language explanations for findings.
  function explainFinding(reasons) {
    const meaningParts = [];
    const recommendationParts = [];

    for (const reason of reasons) {
      const explanation = explanations[reason];

      if (explanation) {
        if (!meaningParts.includes(explanation.meaning)) {
          meaningParts.push(explanation.meaning);
        }

        if (
          !recommendationParts.includes(
            explanation.recommendation
          )
        ) {
          recommendationParts.push(
            explanation.recommendation
          );
        }
      }
    }

    return {
      explanation: meaningParts.join(" "),
      recommendation: recommendationParts.join(" ")
    };
  }

  // ------------------------------
  // ELEMENT DETAILS
  // ------------------------------

  // Get a readable name for the element type.
  function getElementType(el) {
    const tag = el.tagName.toLowerCase();

    if (tag === "input") {
      return `Input (${el.type || "text"})`;
    }

    if (tag === "a") {
      return "Link";
    }

    if (tag === "button") {
      return "Button";
    }

    if (tag === "select") {
      return "Dropdown";
    }

    if (tag === "textarea") {
      return "Text area";
    }

    const role = el.getAttribute("role");

    if (role) {
      return `${tag} (role: ${role})`;
    }

    if (el.hasAttribute("onclick")) {
      return `${tag} (onclick handler)`;
    }

    if (el.hasAttribute("tabindex")) {
      return `${tag} (keyboard accessible)`;
    }

    return tag;
  }

  // Find a readable label or text for the element.
  function getElementLabel(el) {
    const ariaLabel = el.getAttribute("aria-label");

    if (ariaLabel?.trim()) {
      return ariaLabel.trim().slice(0, 200);
    }

    const labelledBy = el.getAttribute("aria-labelledby");

    if (labelledBy) {
      const labelText = labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.innerText || "")
        .join(" ")
        .trim();

      if (labelText) {
        return labelText.slice(0, 200);
      }
    }

    if (el.labels?.length) {
      const labelText = Array.from(el.labels)
        .map(label => label.innerText.trim())
        .filter(Boolean)
        .join(" ");

      if (labelText) {
        return labelText.slice(0, 200);
      }
    }

    const title = el.getAttribute("title");

    if (title?.trim()) {
      return title.trim().slice(0, 200);
    }

    const placeholder = el.getAttribute("placeholder");

    if (placeholder?.trim()) {
      return placeholder.trim().slice(0, 200);
    }

    const value = el.value;

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim().slice(0, 200);
    }

    const text = el.innerText?.trim();

    if (text) {
      return text.slice(0, 200);
    }

    return "No readable label";
  }

  // Get the destination of a link, if applicable.
  function getElementDestination(el) {
    if (el.tagName.toLowerCase() !== "a") {
      return null;
    }

    const href = el.getAttribute("href");

    if (!href) {
      return "No destination specified";
    }

    try {
      return new URL(href, document.baseURI).href;
    } catch {
      return href;
    }
  }

  // Collect all element details in one object.
  function getElementDetails(el) {
    return {
      elementType: getElementType(el),
      elementLabel: getElementLabel(el),
      destination: getElementDestination(el)
    };
  }

  // ------------------------------
  // ELEMENT ID REGISTRY
  // ------------------------------

  // Maps elementId -> actual DOM element.
  // The mapping stays private to this content script:
  // only the string elementId is ever sent to the popup,
  // so page DOM nodes are never exposed through messages.
  const elementRegistry = new Map();

  let elementIdCounter = 0;

  // Assign a fresh, unique elementId to a finding's element.
  function registerElement(el) {
    elementIdCounter += 1;

    const elementId =
      `ghosttrace-element-${elementIdCounter}`;

    elementRegistry.set(elementId, el);

    return elementId;
  }

  // ------------------------------
  // SCAN PAGE
  // ------------------------------

  function scanPage() {
    // A new scan replaces all findings, so the
    // previous elementId mapping is no longer valid.
    elementRegistry.clear();
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
        const details = getElementDetails(el);

        const description =
          details.elementLabel === "No readable label"
            ? details.elementType
            : details.elementLabel;

        findings.push({
          element: el,
          elementId: registerElement(el),
          description,
          ...details,
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

      // Calculate risk after all reasons are added.
      const risk = calculateRisk(finding.reasons);

      finding.riskScore = risk.score;
      finding.riskLevel = risk.level;

      // Attach the explanation to this finding.
      const explanation = explainFinding(
        finding.reasons
      );

      finding.explanation =
        explanation.explanation;

      finding.recommendation =
        explanation.recommendation;
    }

    return findings;
  }

  // ------------------------------
  // HIGHLIGHTS
  // ------------------------------

  // Remove the previous GhostTrace highlight layer.
  function clearHighlights() {
    // Also remove any temporary locate overlay.
    removeLocateOverlay();

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
        riskScore,
        explanation,
        recommendation
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

      // Include element details in the highlight tooltip.
      label.title =
        `Element: ${finding.elementType}\n` +
        `Label: ${finding.elementLabel}\n` +
        `Destination: ${finding.destination || "Not applicable"}\n\n` +
        `Why flagged:\n${reasons.join("\n")}\n\n` +
        `What it means:\n${explanation}\n\n` +
        `What to check:\n${recommendation}`;

      box.appendChild(label);
      layer.appendChild(box);
    }

    document.documentElement.appendChild(layer);
  }

  // ------------------------------
  // LOCATE ELEMENT
  // ------------------------------

  let locateAlignTimer = null;
  let locateCleanupTimer = null;

  // Remove the temporary locate overlay and its timers.
  function removeLocateOverlay() {
    if (locateAlignTimer) {
      clearInterval(locateAlignTimer);
      locateAlignTimer = null;
    }

    if (locateCleanupTimer) {
      clearTimeout(locateCleanupTimer);
      locateCleanupTimer = null;
    }

    document
      .getElementById(LOCATE_LAYER_ID)
      ?.remove();
  }

  // Draw a short-lived overlay around the element.
  // GhostTrace never changes the styles of the page's
  // own elements: the overlay is a separate layer that
  // removes itself after a short time.
  function showLocateOverlay(el) {
    removeLocateOverlay();

    const layer = document.createElement("div");

    layer.id = LOCATE_LAYER_ID;

    Object.assign(layer.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "2147483647",
      pointerEvents: "none",
      overflow: "hidden"
    });

    // Create the blue locate box.
    const box = document.createElement("div");

    Object.assign(box.style, {
      position: "fixed",
      boxSizing: "border-box",
      border: "3px solid #2563eb",
      background: "rgba(37, 99, 235, 0.15)",
      borderRadius: "3px",
      pointerEvents: "none"
    });

    // Create the locate label.
    const label = document.createElement("div");

    label.textContent = "GhostTrace: Element located";

    Object.assign(label.style, {
      position: "fixed",
      maxWidth: "280px",
      padding: "5px 9px",
      background: "#2563eb",
      color: "#ffffff",
      font: "bold 12px Arial, sans-serif",
      lineHeight: "16px",
      borderRadius: "4px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      pointerEvents: "none"
    });

    box.appendChild(label);
    layer.appendChild(box);

    document.documentElement.appendChild(layer);

    // Keep the overlay aligned while a smooth scroll
    // settles, then let it track the element briefly.
    const alignOverlay = () => {
      if (!el.isConnected) {
        removeLocateOverlay();
        return;
      }

      const rect = el.getBoundingClientRect();

      if (
        rect.width === 0 ||
        rect.height === 0
      ) {
        return;
      }

      Object.assign(box.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });

      Object.assign(label.style, {
        left: `${Math.max(0, rect.left)}px`,
        top: `${Math.max(0, rect.top - 30)}px`
      });
    };

    alignOverlay();

    locateAlignTimer = setInterval(
      alignOverlay,
      100
    );

    // The overlay removes itself after a short time.
    locateCleanupTimer = setTimeout(
      removeLocateOverlay,
      2500
    );
  }

  // Find the element for an elementId, scroll it into
  // view, and flash a temporary highlight around it.
  function locateElement(elementId) {
    // The registry lives only inside this content script.
    const el = typeof elementId === "string"
      ? elementRegistry.get(elementId)
      : null;

    if (!el) {
      return {
        success: false,
        reason: "not_found"
      };
    }

    // The element may have been removed since the scan.
    if (!el.isConnected) {
      elementRegistry.delete(elementId);

      return {
        success: false,
        reason: "stale"
      };
    }

    // Bring the exact element into view. This changes
    // the scroll position only, never element styles.
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    showLocateOverlay(el);

    return {
      success: true
    };
  }

  // ------------------------------
  // MESSAGE LISTENER
  // ------------------------------

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
              elementId,
              description,
              elementType,
              elementLabel,
              destination,
              reasons,
              rect,
              riskLevel,
              riskScore,
              explanation,
              recommendation
            }) => ({
              elementId,
              description,
              elementType,
              elementLabel,
              destination,
              reasons,
              riskLevel,
              riskScore,
              explanation,
              recommendation,

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

      if (message.action === "LOCATE_ELEMENT") {
        sendResponse(
          locateElement(message.elementId)
        );
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