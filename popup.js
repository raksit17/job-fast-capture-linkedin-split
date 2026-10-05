const $ = (id) =>
  document.getElementById(id);

async function getState() {
  return chrome.storage.local.get({
    jobs: [],
    endpoint:
      'http://localhost:3000/api/jobs/import',
    autoSend: false
  });
}

function setStatus(message) {
  $('status').textContent =
    message;
}

async function refresh() {
  const state =
    await getState();

  $('count').textContent =
    state.jobs.length;

  $('endpoint').value =
    state.endpoint;

  $('autoSend').checked =
    state.autoSend;
}

async function activeTab() {
  const [tab] =
    await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

  return tab;
}

/*
 * ------------------------------------------------
 * Endpoint setting
 * ------------------------------------------------
 */

$('endpoint').addEventListener(
  'change',
  async () => {
    await chrome.storage.local.set({
      endpoint:
        $('endpoint')
          .value
          .trim()
    });
  }
);

/*
 * ------------------------------------------------
 * Auto send setting
 * ------------------------------------------------
 */

$('autoSend').addEventListener(
  'change',
  async () => {
    await chrome.storage.local.set({
      autoSend:
        $('autoSend').checked
    });
  }
);

/*
 * ------------------------------------------------
 * Scan
 * ------------------------------------------------
 */

$('scan').addEventListener(
  'click',
  async () => {
    try {
      setStatus(
        'Auto scrolling and scanning...'
      );

      const tab =
        await activeTab();

      if (!tab?.id) {
        throw new Error(
          'Active tab not found'
        );
      }

      /*
       * Scan ผ่าน content script
       */
      const response =
        await chrome.tabs.sendMessage(
          tab.id,
          {
            type:
              'AUTO_SCAN_JOBS'
          }
        );

      console.log(
        '[POPUP] scan response',
        response
      );

      if (!response?.ok) {
        throw new Error(
          response?.error ||
          'Scan failed'
        );
      }

      const scannedJobs =
        Array.isArray(
          response.jobs
        )
          ? response.jobs
          : [];

      /*
       * เติม pageType ถ้า content script
       * ยังไม่ได้ส่งมา
       */
      const pageType =
        response.debug?.pageType ??
        'unknown';

      const normalizedJobs =
        scannedJobs.map(
          (job) => ({
            ...job,

            pageType:
              job.pageType ??
              pageType
          })
        );

      /*
       * Save local storage
       */
      const result =
        await chrome.runtime.sendMessage({
          type:
            'SAVE_JOBS',

          jobs:
            normalizedJobs
        });

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          'Cannot save jobs'
        );
      }

      await refresh();

      setStatus(
        `Page: ${pageType}\n` +
        `Found ${normalizedJobs.length}; ` +
        `added ${result.added}; ` +
        `total ${result.total}`
      );

      /*
       * Auto send API
       */
      const state =
        await getState();

      if (
        state.autoSend &&
        result.added > 0
      ) {
        setStatus(
          `Found ${normalizedJobs.length}; ` +
          `added ${result.added}; ` +
          `total ${result.total}\n` +
          'Sending API...'
        );

        /*
         * ส่งเฉพาะ jobs ที่ scan รอบนี้
         *
         * ไม่ต้องส่ง storage ทั้งก้อนซ้ำ
         */
        const sent =
          await chrome.runtime.sendMessage({
            type:
              'SEND_API',

            endpoint:
              state.endpoint,

            jobs:
              normalizedJobs
          });

        if (!sent?.ok) {
          throw new Error(
            sent?.error ||
            'API send failed'
          );
        }

        setStatus(
          `Page: ${pageType}\n` +
          `Found ${normalizedJobs.length}; ` +
          `added ${result.added}; ` +
          `total ${result.total}\n` +
          `API: imported ${sent.imported ?? sent.count ?? 0}, ` +
          `skipped ${sent.skipped ?? 0}, ` +
          `failed ${sent.failed ?? 0}`
        );
      }
    } catch (err) {
      console.error(
        '[POPUP] scan error',
        err
      );

      setStatus(
        err?.message ||
        String(err)
      );
    }
  }
);

/*
 * ------------------------------------------------
 * Send API manually
 * ------------------------------------------------
 */

$('send').addEventListener(
  'click',
  async () => {
    try {
      setStatus(
        'Sending...'
      );

      const state =
        await getState();

      if (
        !Array.isArray(
          state.jobs
        ) ||
        state.jobs.length === 0
      ) {
        setStatus(
          'No jobs to send'
        );

        return;
      }

      if (!state.endpoint) {
        throw new Error(
          'API endpoint is empty'
        );
      }

      const result =
        await chrome.runtime.sendMessage({
          type:
            'SEND_API',

          endpoint:
            state.endpoint,

          jobs:
            state.jobs
        });

      console.log(
        '[POPUP] API result',
        result
      );

      if (!result?.ok) {
        throw new Error(
          result?.error ||
          'API send failed'
        );
      }

      setStatus(
        `API import completed\n` +
        `Received: ${result.received ?? state.jobs.length}\n` +
        `Imported: ${result.imported ?? result.count ?? 0}\n` +
        `Skipped: ${result.skipped ?? 0}\n` +
        `Duplicates: ${result.duplicates ?? 0}\n` +
        `Failed: ${result.failed ?? 0}`
      );
    } catch (err) {
      console.error(
        '[POPUP] send error',
        err
      );

      setStatus(
        err?.message ||
        String(err)
      );
    }
  }
);

/*
 * ------------------------------------------------
 * Export JSON
 * ------------------------------------------------
 */

$('json').addEventListener(
  'click',
  async () => {
    const result =
      await chrome.runtime.sendMessage({
        type:
          'EXPORT_JSON'
      });

    setStatus(
      result?.ok
        ? 'JSON export started'
        : result?.error ||
          'JSON export failed'
    );
  }
);

/*
 * ------------------------------------------------
 * Export CSV
 * ------------------------------------------------
 */

$('csv').addEventListener(
  'click',
  async () => {
    const result =
      await chrome.runtime.sendMessage({
        type:
          'EXPORT_CSV'
      });

    setStatus(
      result?.ok
        ? 'CSV export started'
        : result?.error ||
          'CSV export failed'
    );
  }
);

/*
 * ------------------------------------------------
 * Clear storage
 * ------------------------------------------------
 */

$('clear').addEventListener(
  'click',
  async () => {
    await chrome.storage.local.set({
      jobs: []
    });

    await refresh();

    setStatus(
      'Cleared'
    );
  }
);

refresh();