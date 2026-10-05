function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url || "";
  }
}

function jobKey(job) {
  return [
    job.source || "",
    job.externalId || "",
    normalizeUrl(job.jobUrl || ""),
  ].join("|");
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

function withFeedExtras(job) {
  const contractText = job.contractText ?? job.contract ?? null;

  const emails = uniqueStrings(job.emails ?? job.email ?? []);

  const contacts = uniqueStrings(job.contacts ?? job.contact ?? []);

  const imageUrls = uniqueStrings(job.imageUrls ?? job.images ?? []);

  const postedBy = job.postedBy ?? job.posterName ?? null;

  const posterProfileUrl = job.posterProfileUrl ?? job.posterUrl ?? null;

  const dmContact =
    job.dmContact && typeof job.dmContact === "object"
      ? {
          type: job.dmContact.type || "linkedin_dm",

          name: job.dmContact.name || postedBy || null,

          profileUrl: job.dmContact.profileUrl || posterProfileUrl || null,
        }
      : null;

  return {
    ...job,
    postedBy,
    posterProfileUrl,
    dmContact,
    contractText,
    contract: contractText,
    emails,
    email: emails,
    contacts,
    contact: contacts,
    imageUrls,
    images: imageUrls,
  };
}

function toCsv(rows) {
  const fields = [
    "source",
    "externalId",
    "title",
    "company",
    "location",
    "salaryText",
    "postedBy",
    "posterProfileUrl",
    "dmContact",
    "contractText",
    "contract",
    "emails",
    "email",
    "contacts",
    "contact",
    "imageUrls",
    "images",
    "description",
    "requirements",
    "technologies",
    "jobUrl",
    "postedAt",
  ];

  const esc = (value) => {
    const s = Array.isArray(value)
      ? value.join(" | ")
      : value && typeof value === "object"
        ? JSON.stringify(value)
        : String(value ?? "");

    return `"${s.replaceAll('"', '""')}"`;
  };

  return [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => esc(row[field])).join(",")),
  ].join("\n");
}

async function downloadText(filename, text, mime) {
  const url = "data:" + mime + ";charset=utf-8," + encodeURIComponent(text);

  await chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "SAVE_JOBS") {
      const current = await chrome.storage.local.get({
        jobs: [],
      });

      const map = new Map(current.jobs.map((job) => [jobKey(job), job]));

      let added = 0;

      for (const job of message.jobs || []) {
        const normalized = {
          source: job.source,

          /*
           * สำคัญสำหรับ Import Adapter
           *
           * linkedin + feed
           * linkedin + job
           * jobthai + detail
           * wellfound + search
           */
          pageType: job.pageType ?? null,

          externalId: job.externalId,

          title: job.title,

          company: job.company ?? null,

          location: job.location ?? null,

          salaryText: job.salaryText ?? null,

          postedBy: job.postedBy ?? job.posterName ?? null,

          posterProfileUrl: job.posterProfileUrl ?? job.posterUrl ?? null,

          dmContact:
            job.dmContact && typeof job.dmContact === "object"
              ? job.dmContact
              : null,

          contractText: job.contractText ?? job.contract ?? null,

          contract: job.contractText ?? job.contract ?? null,

          emails: uniqueStrings(job.emails ?? job.email ?? []),

          email: uniqueStrings(job.emails ?? job.email ?? []),

          contacts: uniqueStrings(job.contacts ?? job.contact ?? []),

          contact: uniqueStrings(job.contacts ?? job.contact ?? []),

          imageUrls: uniqueStrings(job.imageUrls ?? job.images ?? []),

          images: uniqueStrings(job.imageUrls ?? job.images ?? []),

          description: job.description ?? null,

          requirements: Array.isArray(job.requirements) ? job.requirements : [],

          technologies: Array.isArray(job.technologies) ? job.technologies : [],

          jobUrl: job.jobUrl,

          postedAt: job.postedAt ?? null,
        };

        const key = jobKey(normalized);

        if (!map.has(key)) {
          added++;
        }

        const previous = map.get(key) || {};

        map.set(
          key,
          withFeedExtras({
            ...previous,
            ...normalized,
            contractText:
              normalized.contractText || previous.contractText || null,
            emails: uniqueStrings([
              ...(previous.emails || []),
              ...normalized.emails,
            ]),
            contacts: uniqueStrings([
              ...(previous.contacts || []),
              ...normalized.contacts,
            ]),
            imageUrls: uniqueStrings([
              ...(previous.imageUrls || []),
              ...normalized.imageUrls,
            ]),
            requirements: normalized.requirements.length
              ? normalized.requirements
              : previous.requirements || [],
            technologies: normalized.technologies.length
              ? normalized.technologies
              : previous.technologies || [],
            description:
              (normalized.description?.length || 0) >=
              (previous.description?.length || 0)
                ? normalized.description
                : (previous.description ?? null),
          }),
        );
      }

      const jobs = [...map.values()];

      await chrome.storage.local.set({
        jobs,
      });

      sendResponse({
        ok: true,
        added,
        total: jobs.length,
      });

      return;
    }

    if (message.type === "SEND_API") {
      try {
        /*
         * รองรับทั้ง:
         *
         * 1. popup ส่ง jobs/endpoint มาโดยตรง
         *
         * 2. popup รุ่นเก่าไม่ส่งมา
         *    → fallback ไป storage
         */

        const stored = await chrome.storage.local.get({
          jobs: [],
          endpoint: "http://localhost:3000/api/jobs/import",
        });

        const endpoint = message.endpoint || stored.endpoint;

        const jobs = Array.isArray(message.jobs) ? message.jobs : stored.jobs;

        if (!endpoint) {
          sendResponse({
            ok: false,
            error: "API endpoint is empty",
          });

          return;
        }

        if (!Array.isArray(jobs)) {
          sendResponse({
            ok: false,
            error: "Jobs must be an array",
          });

          return;
        }

        if (jobs.length === 0) {
          sendResponse({
            ok: true,

            count: 0,
            received: 0,
            imported: 0,
            skipped: 0,
            duplicates: 0,
            failed: 0,
          });

          return;
        }

        console.log("[API] sending", jobs.length, "jobs to", endpoint);

        /*
         * Nest:
         *
         * @Post('import')
         * @Body() body: JobImportBody
         *
         * รองรับ:
         *
         * {
         *   jobs: [...]
         * }
         */
        const res = await fetch(endpoint, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            Accept: "application/json",
          },

          body: JSON.stringify({
            jobs,
          }),
        });

        const raw = await res.text();

        console.log("[API] status", res.status, raw.slice(0, 1000));

        /*
         * อ่าน JSON response จาก Nest
         */
        let data = {};

        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = {
              message: raw,
            };
          }
        }

        if (!res.ok) {
          let errorMessage =
            data?.message ?? data?.error ?? raw ?? `HTTP ${res.status}`;

          if (Array.isArray(errorMessage)) {
            errorMessage = errorMessage.join(", ");
          }

          throw new Error(`HTTP ${res.status}: ${errorMessage}`);
        }

        /*
         * ส่งผลจริงที่ Nest normalize/import กลับ popup
         *
         * ตัวอย่าง:
         *
         * {
         *   ok: true,
         *   count: 8,
         *   received: 20,
         *   imported: 8,
         *   skipped: 10,
         *   duplicates: 2,
         *   failed: 0
         * }
         */
        sendResponse({
          ok: true,

          ...data,

          /*
           * fallback
           * ถ้า backend ไม่มี count
           */
          count: data.imported ?? data.count ?? jobs.length,
        });
      } catch (err) {
        console.error("[API] SEND_API failed", err);

        sendResponse({
          ok: false,

          error: err?.message || String(err),
        });
      }

      return;
    }

    if (message.type === "EXPORT_JSON") {
      const { jobs = [] } = await chrome.storage.local.get({
        jobs: [],
      });

      await downloadText(
        `job-capture-${Date.now()}.json`,
        JSON.stringify(jobs.map(withFeedExtras), null, 2),
        "application/json",
      );

      sendResponse({
        ok: true,
      });

      return;
    }

    if (message.type === "EXPORT_CSV") {
      const { jobs = [] } = await chrome.storage.local.get({
        jobs: [],
      });

      await downloadText(
        `job-capture-${Date.now()}.csv`,
        toCsv(jobs.map(withFeedExtras)),
        "text/csv",
      );

      sendResponse({
        ok: true,
      });

      return;
    }

    sendResponse({
      ok: false,
      error: "Unknown message",
    });
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const { jobs = [] } = await chrome.storage.local.get({
    jobs: [],
  });

  if (!jobs.length) {
    return;
  }

  await chrome.storage.local.set({
    jobs: jobs.map(withFeedExtras),
  });

  console.log("[JOB CAPTURE] Feed extras migration complete:", jobs.length);
});
