(() => {
  const App =
    window.JobFastCapture =
      window.JobFastCapture || {};

  const Shared = {};

  Shared.sleep = function (ms) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  };

  Shared.textOf = function (el) {
    return (
      el?.innerText ||
      el?.textContent ||
      ''
    )
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  Shared.unique = function (values) {
    return [
      ...new Set(
        values.filter(Boolean)
      )
    ];
  };

  Shared.hashString = function (value) {
    let hash = 0;

    for (
      let i = 0;
      i < value.length;
      i++
    ) {
      hash =
        (
          (hash << 5) -
          hash +
          value.charCodeAt(i)
        ) | 0;
    }

    return Math.abs(hash).toString();
  };

  Shared.extractSalary =
    function (text) {
      if (!text) {
        return null;
      }

      const patterns = [
        /฿\s?[\d,.]+(?:\s?[-–]\s?฿?\s?[\d,.]+)?/i,
        /[\d,.]+\s?[-–]\s?[\d,.]+\s?(?:THB|USD|SGD|MYR|EUR|GBP|JPY|AUD|CAD)(?:\/(?:month|year|hour|day))?/i,
        /(?:THB|USD|SGD|MYR|EUR|GBP|JPY|AUD|CAD)\s?[\d,.]+(?:\s?[-–]\s?[\d,.]+)?/i,
        /\$[\d,.]+(?:\s?[-–]\s?\$?[\d,.]+)?/i,
        /€[\d,.]+(?:\s?[-–]\s?€?\s?[\d,.]+)?/i
      ];

      for (const pattern of patterns) {
        const match =
          text.match(pattern);

        if (match) {
          return match[0];
        }
      }

      return null;
    };

  const TECH = [
    'Node.js',
    'NestJS',
    'TypeScript',
    'JavaScript',
    'Express',
    'Express.js',
    'React',
    'Next.js',
    'Vue',
    'Vue.js',
    'Angular',
    'PostgreSQL',
    'MySQL',
    'MongoDB',
    'Redis',
    'Prisma',
    'TypeORM',
    'Sequelize',
    'Docker',
    'Kubernetes',
    'AWS',
    'GCP',
    'Azure',
    'REST',
    'GraphQL',
    'Java',
    'Spring',
    'Spring Boot',
    'Python',
    'Django',
    'FastAPI',
    'PHP',
    'Laravel',
    'C#',
    '.NET',
    'ASP.NET',
    'Go',
    'Golang',
    'Rust',
    'Ruby',
    'Ruby on Rails',
    'Kafka',
    'RabbitMQ',
    'Git',
    'GitHub',
    'GitLab',
    'CI/CD',
    'Terraform',
    'Microservices'
  ];

  Shared.extractTechnologies =
    function (text) {
      if (!text) {
        return [];
      }

      const lower =
        text.toLowerCase();

      return Shared.unique(
        TECH.filter(
          technology =>
            lower.includes(
              technology
                .toLowerCase()
            )
        )
      );
    };

  Shared.extractRequirements =
    function (text) {
      if (!text) {
        return [];
      }

      const lines =
        text
          .split(/\n+/)
          .map(x => x.trim())
          .filter(Boolean);

      const result = [];
      let active = false;

      for (const line of lines) {
        if (
          /requirements?|qualifications?|คุณสมบัติ|คุณสมบัติผู้สมัคร|what you bring|what we're looking for|must have/i.test(
            line
          )
        ) {
          active = true;
          continue;
        }

        if (
          active &&
          /benefits?|responsibilities?|about us|หน้าที่|สวัสดิการ|what we offer|preferred qualifications?/i.test(
            line
          )
        ) {
          break;
        }

        if (
          active &&
          line.length > 3
        ) {
          result.push(
            line.replace(
              /^[-•*]\s*/,
              ''
            )
          );
        }
      }

      return Shared.unique(
        result
      );
    };

  Shared.extractPostedAt =
    function (root) {
      const time =
        root?.querySelector?.(
          'time[datetime]'
        );

      if (!time) {
        return null;
      }

      const raw =
        time.getAttribute(
          'datetime'
        );

      if (!raw) {
        return null;
      }

      const date =
        new Date(raw);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return null;
      }

      return date.toISOString();
    };

  Shared.waitFor =
    async function (
      callback,
      {
        timeout = 5000,
        interval = 150
      } = {}
    ) {
      const started =
        Date.now();

      while (
        Date.now() -
          started <
        timeout
      ) {
        const result =
          callback();

        if (result) {
          return result;
        }

        await Shared.sleep(
          interval
        );
      }

      return null;
    };

  Shared.findScrollParent =
    function (element) {
      let current =
        element?.parentElement;

      while (current) {
        const style =
          getComputedStyle(
            current
          );

        if (
          /auto|scroll/.test(
            style.overflowY
          ) &&
          current.scrollHeight >
            current.clientHeight +
              200
        ) {
          return current;
        }

        current =
          current.parentElement;
      }

      return (
        document.scrollingElement ||
        document.documentElement
      );
    };

  Shared.findBestScrollContainer =
    function () {
      const candidates = [
        ...document.querySelectorAll(
          'main, section, div'
        )
      ]
        .filter(el => {
          const style =
            getComputedStyle(el);

          return (
            /auto|scroll/.test(
              style.overflowY
            ) &&
            el.scrollHeight >
              el.clientHeight +
                400
          );
        })
        .sort(
          (a, b) =>
            (
              b.scrollHeight -
              b.clientHeight
            ) -
            (
              a.scrollHeight -
              a.clientHeight
            )
        );

      return (
        candidates[0] ||
        document.scrollingElement ||
        document.documentElement
      );
    };

  Shared.scrollBy =
    function (
      root,
      amount
    ) {
      if (
        root ===
          document.scrollingElement ||
        root ===
          document.documentElement ||
        root ===
          document.body
      ) {
        window.scrollBy({
          top: amount,
          behavior: 'smooth'
        });

        return;
      }

      root.scrollBy({
        top: amount,
        behavior: 'smooth'
      });
    };

  Shared.saveJobs =
    async function (jobs) {
      if (
        !jobs ||
        jobs.length === 0
      ) {
        return;
      }

      try {
        await chrome.runtime
          .sendMessage({
            type:
              'SAVE_JOBS',
            jobs
          });
      } catch (error) {
        console.warn(
          '[JFC] save failed',
          error
        );
      }
    };

  App.Shared =
    Shared;
})();