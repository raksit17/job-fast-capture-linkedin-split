(() => {
  const App = window.JobFastCapture;

  const S = App.Shared;

  const Jobs = {};

  Jobs.isPage = function () {
    return (
      location.hostname === "www.linkedin.com" &&
      (location.pathname === "/jobs/" ||
        location.pathname.startsWith("/jobs/search") ||
        location.pathname.startsWith("/jobs/collections"))
    );
  };

  function findCardFromDismiss(button) {
    let node = button.parentElement;

    while (node && node !== document.body) {
      if (node.matches?.('[role="button"]') && S.textOf(node).length > 20) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  function getCards() {
    const result = new Set();

    for (const card of document.querySelectorAll(
      '[componentkey^="job-card-component-ref-"]',
    )) {
      result.add(card);
    }

    const dismissButtons = [
      ...document.querySelectorAll(
        [
          'button[aria-label^="ปิดงาน "]',
          'button[aria-label^="Dismiss job "]',
        ].join(","),
      ),
    ];

    for (const button of dismissButtons) {
      const card = findCardFromDismiss(button);

      if (card) {
        result.add(card);
      }
    }

    const cards = [...result];

    console.log("[JOBS] cards:", cards.length);

    return cards;
  }

  function cleanTitle(value) {
    if (!value) {
      return null;
    }

    return value
      .replace(/\s*\(งานที่ได้รับการตรวจสอบ\)\s*/gi, "")
      .replace(/\s*\(verified job\)\s*/gi, "")
      .trim();
  }

  function getTitle(card) {
    const close = card.querySelector(
      [
        'button[aria-label^="ปิดงาน "]',
        'button[aria-label^="Dismiss job "]',
      ].join(","),
    );

    const label = close?.getAttribute("aria-label");

    if (label) {
      return cleanTitle(
        label.replace(/^ปิดงาน\s*/i, "").replace(/^Dismiss job\s*/i, ""),
      );
    }

    const spans = [...card.querySelectorAll('span[aria-hidden="true"]')];

    for (const span of spans) {
      const value = cleanTitle(S.textOf(span));

      if (value && value.length > 2 && value.length < 250) {
        return value;
      }
    }

    return null;
  }

  function jobIdFromUrl(url) {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url, location.origin);

      const view = parsed.pathname.match(/\/jobs\/view\/(\d+)/);

      if (view) {
        return view[1];
      }

      const current = parsed.searchParams.get("currentJobId");

      if (current && /^\d+$/.test(current)) {
        return current;
      }
    } catch {}

    return null;
  }

  function getCardJobId(card) {
    const componentKey = card.getAttribute("componentkey");

    const componentId = componentKey?.match(
      /job-card-component-ref-(\d+)/,
    )?.[1];

    if (componentId) {
      return componentId;
    }

    const links = [...card.querySelectorAll("a[href]")];

    for (const link of links) {
      const id = jobIdFromUrl(link.href);

      if (id) {
        return id;
      }
    }

    return null;
  }

  function getLines(card) {
    return S.textOf(card)
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x !== "•");
  }

  function isNoise(value) {
    return (
      !value ||
      /^ดูแล้ว$/i.test(value) ||
      /^สมัครอย่างง่าย$/i.test(value) ||
      /^easy apply$/i.test(value) ||
      /^การตรวจสอบผู้สมัคร/i.test(value) ||
      /^actively reviewing/i.test(value) ||
      /^เป็นผู้สมัครคนแรก/i.test(value) ||
      /^โพสต์แล้ว/i.test(value) ||
      /ที่ผ่านมา$/i.test(value) ||
      /\bago$/i.test(value) ||
      /^คนรู้จัก .* ทำงานที่นี่/i.test(value)
    );
  }

  function getCompanyLocation(card, title) {
    const lines = getLines(card);

    const titleIndex = lines.findIndex(
      (line) => cleanTitle(line) === title || cleanTitle(line)?.includes(title),
    );

    const after = lines
      .slice(titleIndex >= 0 ? titleIndex + 1 : 0)
      .filter((line) => !isNoise(line))
      .filter((line) => !S.extractSalary(line));

    return {
      company: after[0] || null,

      location: after[1] || null,
    };
  }

  function parseCard(card) {
    const title = getTitle(card);

    if (!title) {
      return null;
    }

    const { company, location: jobLocation } = getCompanyLocation(card, title);

    const id = getCardJobId(card);

    const fingerprint = S.hashString(
      [title, company, jobLocation].filter(Boolean).join("|"),
    );

    const externalId = id || `temp-${fingerprint}`;

    const text = S.textOf(card);

    return {
      source: "linkedin",

      externalId,

      title,

      company,

      location: jobLocation,

      salaryText: S.extractSalary(text),

      description: null,

      requirements: [],

      technologies: S.extractTechnologies(text),

      jobUrl: id ? `https://www.linkedin.com/jobs/view/${id}/` : location.href,

      postedAt: S.extractPostedAt(card),

      __fingerprint: fingerprint,
    };
  }

  function getDetailPanel() {
    return (
      document.querySelector('[data-sdui-screen*="SemanticJobDetails"]') ||
      document.querySelector('[data-sdui-screen*="JobDetails"]') ||
      document.querySelector("#job-details") ||
      document.querySelector('[data-testid*="job-details"]')
    );
  }

  function detailSignature() {
    const panel = getDetailPanel();

    if (!panel) {
      return "";
    }

    return S.textOf(panel).slice(0, 500);
  }

  function getIdFromDetail(panel) {
    let id = jobIdFromUrl(location.href);

    if (id) {
      return id;
    }

    const links = [...panel.querySelectorAll("a[href]")];

    for (const link of links) {
      id = jobIdFromUrl(link.href);

      if (id) {
        return id;
      }
    }

    return null;
  }

  function extractDescription(panel) {
    if (!panel) {
      return null;
    }

    const candidates = [...panel.querySelectorAll("section, article, div")]
      .map((el) => ({
        text: S.textOf(el),
      }))
      .filter(
        (item) =>
          item.text.length > 250 &&
          (/about the job/i.test(item.text) ||
            /เกี่ยวกับงาน/i.test(item.text) ||
            /requirements?/i.test(item.text) ||
            /responsibilit/i.test(item.text) ||
            /qualifications?/i.test(item.text)),
      )
      .sort((a, b) => a.text.length - b.text.length);

    if (candidates.length > 0) {
      return candidates[0].text.slice(0, 30000);
    }

    return S.textOf(panel).slice(0, 30000);
  }

  function findCardForJob(job) {
    const cards = getCards();

    if (!job.externalId.startsWith("temp-")) {
      for (const card of cards) {
        if (getCardJobId(card) === job.externalId) {
          return card;
        }
      }
    }

    for (const card of cards) {
      const candidate = parseCard(card);

      if (candidate?.__fingerprint === job.__fingerprint) {
        return card;
      }
    }

    return null;
  }

  async function openDetail(job) {
    const card = findCardForJob(job);

    if (!card) {
      return null;
    }

    const before = detailSignature();

    card.scrollIntoView({
      block: "center",
      behavior: "instant",
    });

    await S.sleep(100);

    console.log("[JOBS] click:", job.title);

    card.click();

    await S.sleep(250);

    return await S.waitFor(
      () => {
        const panel = getDetailPanel();

        if (!panel) {
          return null;
        }

        const after = detailSignature();

        if (after && (!before || after !== before)) {
          return panel;
        }

        return null;
      },
      {
        timeout: 5000,
      },
    );
  }

  async function enrich(job) {
    const panel = await openDetail(job);

    if (!panel) {
      return job;
    }

    const description = extractDescription(panel);

    const detailText = S.textOf(panel);

    const id = getIdFromDetail(panel);

    return {
      ...job,

      externalId: id || job.externalId,

      salaryText: job.salaryText || S.extractSalary(detailText),

      description,

      requirements: S.extractRequirements(description || detailText),

      technologies: S.extractTechnologies(
        [job.title, description, detailText].filter(Boolean).join("\n"),
      ),

      jobUrl: id ? `https://www.linkedin.com/jobs/view/${id}/` : job.jobUrl,

      postedAt: job.postedAt || S.extractPostedAt(panel),
    };
  }

  function clean(job) {
    const { __fingerprint, ...result } = job;

    return result;
  }

  Jobs.scanVisible = function () {
    const map = new Map();

    for (const card of getCards()) {
      const job = parseCard(card);

      if (!job) {
        continue;
      }

      map.set(job.externalId, clean(job));
    }

    return [...map.values()];
  };

  function getJobsScrollRoot() {
    const cards = getCards();

    if (cards.length > 0) {
      const parent = S.findScrollParent(cards[0]);

      if (parent) {
        return parent;
      }
    }

    return S.findBestScrollContainer();
  }

  Jobs.collectAll = async function (options = {}) {
    const {
      maxRounds = 250,
      stagnantLimit = 10,
      scrollDelay = 900,
      detailDelay = 250,
    } = options;

    const jobs = new Map();

    const processed = new Set();

    const scrollRoot = getJobsScrollRoot();

    console.log("[JOBS] AUTO START", {
      scrollHeight: scrollRoot?.scrollHeight,
      clientHeight: scrollRoot?.clientHeight,
    });

    let stagnant = 0;
    let previousSize = 0;

    for (let round = 0; round < maxRounds; round++) {
      const cards = getCards();

      const visibleBasics = cards.map(parseCard).filter(Boolean);

      console.log("[JOBS] round", {
        round,
        visible: visibleBasics.length,
        total: jobs.size,
      });

      for (const basic of visibleBasics) {
        const processKey = basic.__fingerprint;

        if (processed.has(processKey)) {
          continue;
        }

        processed.add(processKey);

        let fullJob = basic;

        try {
          fullJob = await enrich(basic);
        } catch (error) {
          console.error("[JOBS] enrich error", error);
        }

        if (fullJob.externalId !== basic.externalId) {
          jobs.delete(basic.externalId);
        }

        jobs.set(fullJob.externalId, fullJob);

        await S.saveJobs([clean(fullJob)]);

        console.log("[JOBS] saved", {
          id: fullJob.externalId,
          title: fullJob.title,
          company: fullJob.company,
          tech: fullJob.technologies,
          description: fullJob.description?.length || 0,
        });

        await S.sleep(detailDelay);
      }

      if (jobs.size === previousSize) {
        stagnant++;
      } else {
        stagnant = 0;
      }

      previousSize = jobs.size;

      const beforeTop = scrollRoot.scrollTop;

      const beforeHeight = scrollRoot.scrollHeight;

      S.scrollBy(scrollRoot, Math.max(600, scrollRoot.clientHeight * 0.8));

      await S.sleep(scrollDelay);

      const afterTop = scrollRoot.scrollTop;

      const afterHeight = scrollRoot.scrollHeight;

      const moved = Math.abs(afterTop - beforeTop) > 3;

      const grew = Math.abs(afterHeight - beforeHeight) > 20;

      if (!moved && !grew) {
        stagnant++;
      }

      console.log("[JOBS] scroll", {
        beforeTop,
        afterTop,
        beforeHeight,
        afterHeight,
        stagnant,
      });

      if (stagnant >= stagnantLimit) {
        break;
      }
    }

    const output = [...jobs.values()].map(clean);

    console.log("[JOBS] FINISHED:", output.length);

    return output;
  };

  App.LinkedInJobs = Jobs;
})();
