
(() => {
  // Prevent the scanner from being installed more than once.
  if (window.__ghostTraceInstalled) {
    return;
  }

  window.__ghostTraceInstalled = true;

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

  function scanPage() {
    const elements = [
      ...document.querySelectorAll(selector)
    ];

    const findings = [];
    const visibleTargets = [];

    for (const el of elements) {
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

      // Only record visible, reasonably sized targets
      // for the overlap comparison.
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
    }

    return findings;
  }

  // Remove our previous highlights without
  // removing the website's original inline styles.
  function clearHighlights() {
    document
      .querySelectorAll(
        "[data-ghosttrace-highlight]"
      )
      .forEach((el) => {
        el.style.outline =
          el.dataset.ghosttraceOldOutline || "";

        el.style.outlineOffset =
          el.dataset.ghosttraceOldOffset || "";

        delete el.dataset.ghosttraceOldOutline;
        delete el.dataset.ghosttraceOldOffset;
        delete el.dataset.ghosttraceHighlight;
      });
  }

  function highlightFindings(findings) {
    clearHighlights();

    findings.forEach(({ element }) => {
      element.dataset.ghosttraceOldOutline =
        element.style.outline;

      element.dataset.ghosttraceOldOffset =
        element.style.outlineOffset;

      element.dataset.ghosttraceHighlight = "true";

      element.style.setProperty(
        "outline",
        "3px solid #ff3b30",
        "important"
      );

      element.style.setProperty(
        "outline-offset",
        "2px",
        "important"
      );
    });
  }

  // Listen for messages from the extension popup.
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message.action === "SCAN_PAGE") {
        const findings = scanPage();

        highlightFindings(findings);

        // Send plain data to the popup.
        // Never send DOM elements directly.
        sendResponse({
          count: findings.length,

          findings: findings.map(
            ({ description, reasons, rect }) => ({
              description,
              reasons,

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