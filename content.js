(() => {
  const App = window.JobFastCapture;

  function getScanner() {
    if (App.LinkedInFeed?.isPage()) {
      return {
        type: "feed",
        scanner: App.LinkedInFeed,
      };
    }

    if (App.LinkedInJobs?.isPage()) {
      return {
        type: "jobs",
        scanner: App.LinkedInJobs,
      };
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "SCAN_JOBS" && message.type !== "AUTO_SCAN_JOBS") {
      return;
    }

    (async () => {
      try {
        const found = getScanner();

        if (!found) {
          sendResponse({
            ok: false,
            jobs: [],
            error: `Unsupported LinkedIn page: ${location.pathname}`,
          });

          return;
        }

        const auto = message.type === "AUTO_SCAN_JOBS";

        console.log("[JOB CAPTURE]", {
          page: found.type,
          mode: auto ? "AUTO" : "VISIBLE",
          url: location.href,
        });

        const jobs = auto
          ? await found.scanner.collectAll(message.options || {})
          : found.scanner.scanVisible();

        console.log("[JOB CAPTURE] DONE", {
          page: found.type,
          count: jobs.length,
        });

        sendResponse({
          ok: true,
          jobs,
          debug: {
            pageType: found.type,
            pathname: location.pathname,
            total: jobs.length,
          },
        });
      } catch (error) {
        console.error("[JOB CAPTURE ERROR]", error);

        sendResponse({
          ok: false,
          jobs: [],
          error: error?.message || String(error),
        });
      }
    })();

    return true;
  });

  console.log("[JOB CAPTURE] content ready", location.href);
})();
