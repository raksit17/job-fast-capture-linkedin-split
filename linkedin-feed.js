(() => {
  const App =
    window.JobFastCapture;

  const S =
    App.Shared;

  const Feed = {};

  Feed.isPage =
    function () {
      return (
        location.hostname ===
          'www.linkedin.com' &&
        location.pathname
          .startsWith('/feed')
      );
    };

  /* =======================================================
   * ROOT / POSTS
   * ===================================================== */

  function getFeedRoot() {
    return (
      document.querySelector(
        '[data-sdui-screen="com.linkedin.sdui.flagshipnav.feed.MainFeed"]'
      ) ||
      document.querySelector(
        '[data-testid="mainFeed"]'
      ) ||
      document.querySelector(
        '[componentkey*="mainFeed"]'
      )
    );
  }

  function getPosts() {
    const root =
      getFeedRoot();

    if (!root) {
      console.log(
        '[FEED] root not found'
      );

      return [];
    }

    /*
     * Current LinkedIn SDUI feed cards use:
     * role="listitem"
     * componentkey="update-card-focus..."
     *
     * Prefer this so comments/carousels are not mistaken for posts.
     */
    const direct = [
      ...root.querySelectorAll(
        '[role="listitem"][componentkey^="update-card-focus"]'
      )
    ];

    if (direct.length) {
      return direct;
    }

    /* fallback for another LinkedIn rollout */
    const all = [
      ...root.querySelectorAll(
        '[role="listitem"]'
      )
    ];

    return all.filter(post => {
      const text =
        S.textOf(post);

      if (!text) {
        return false;
      }

      return (
        post.querySelector(
          '[data-testid="expandable-text-box"]'
        ) ||
        /โพสต์บนฟีด|post on feed/i.test(
          text.slice(0, 500)
        )
      );
    });
  }

  function getPostKey(post) {
    if (!post) {
      return null;
    }

    return (
      post.getAttribute(
        'componentkey'
      ) ||
      post.id ||
      `post-${S.hashString(
        S.textOf(post).slice(
          0,
          1200
        )
      )}`
    );
  }

  function visiblePostSignature() {
    return getPosts()
      .map(getPostKey)
      .filter(Boolean)
      .join('|');
  }

  async function scrollFeedDown() {
    const posts =
      getPosts();

    console.log(
      '[FEED] scroll request',
      {
        visiblePosts:
          posts.length,
        windowY:
          window.scrollY,
        documentHeight:
          document.documentElement
            .scrollHeight
      }
    );

    if (posts.length) {
      const lastPost =
        posts[
          posts.length - 1
        ];

      /*
       * Key fix:
       * do not guess LinkedIn's scroll container.
       * scrollIntoView() asks the browser to scroll the actual
       * scrollable ancestor containing the feed card.
       */
      lastPost.scrollIntoView({
        block: 'end',
        inline: 'nearest',
        behavior: 'instant'
      });

      await S.sleep(250);
    }

    /*
     * Extra nudge for document-scrolling layouts and lazy loading.
     */
    window.scrollBy({
      top: Math.max(
        450,
        Math.floor(
          window.innerHeight *
          0.7
        )
      ),
      left: 0,
      behavior: 'instant'
    });

    await S.sleep(700);
  }

  /* =======================================================
   * JOB DETECTION
   * ===================================================== */

  function looksLikeJobPost(text) {
    const value =
      text
        .normalize('NFKC')
        .toLowerCase();

    let score = 0;

    const strong = [
      'we are hiring',
      "we're hiring",
      'now hiring',
      '#hiring',
      'job opening',
      'job opportunity',
      'vacancy',
      'apply now',
      'open position',
      'interested candidates',
      'send your cv',
      'send your resume',
      'รับสมัคร',
      'เปิดรับสมัคร',
      'ตำแหน่งงาน',
      'สมัครงาน',
      'ส่ง cv',
      'ส่ง resume'
    ];

    const roles = [
      'developer',
      'engineer',
      'programmer',
      'software',
      'backend',
      'back-end',
      'frontend',
      'front-end',
      'full stack',
      'full-stack',
      'devops',
      'qa engineer',
      'data engineer',
      'project manager',
      'business analyst',
      'cloud engineer',
      'support',
      'analyst'
    ];

    for (const keyword of strong) {
      if (value.includes(keyword)) {
        score += 3;
      }
    }

    for (const keyword of roles) {
      if (value.includes(keyword)) {
        score += 1;
      }
    }

    return score >= 3;
  }

  /* =======================================================
   * URL / ID
   * ===================================================== */

  function unwrapLinkedInRedirect(
    href
  ) {
    if (!href) {
      return null;
    }

    try {
      const u =
        new URL(
          href,
          location.origin
        );

      if (
        u.hostname ===
          'www.linkedin.com' &&
        u.pathname ===
          '/safety/go/'
      ) {
        const target =
          u.searchParams.get(
            'url'
          );

        if (target) {
          return decodeURIComponent(
            target
          );
        }
      }

      return u.href;
    } catch {
      return href;
    }
  }

  function getPostUrl(post) {
    const links = [
      ...post.querySelectorAll(
        'a[href]'
      )
    ];

    const feedUpdate =
      links.find(a =>
        a.href.includes(
          '/feed/update/'
        )
      );

    if (feedUpdate) {
      return feedUpdate.href;
    }

    const postLink =
      links.find(a =>
        a.href.includes(
          '/posts/'
        )
      );

    return (
      postLink?.href ||
      null
    );
  }

  function getActivityId(url) {
    if (!url) {
      return null;
    }

    return (
      url.match(
        /activity[:-](\d+)/
      )?.[1] ||
      url.match(
        /urn%3Ali%3Aactivity%3A(\d+)/
      )?.[1] ||
      url.match(
        /urn:li:(?:activity|share):(\d+)/
      )?.[1] ||
      null
    );
  }

  /* =======================================================
   * POSTER / WHO TO DM
   * ===================================================== */

  function cleanPosterName(value) {
    if (!value) {
      return null;
    }

    let result =
      value
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim();

    result =
      result
        .replace(
          /^(?:ดูโพรไฟล์ของ|ดูบริษัท:)\s*/i,
          ''
        )
        .replace(
          /\s+(?:โพรไฟล์(?:\s+ตรวจสอบแล้ว)?|Premium|ตรวจสอบแล้ว)(?:\s+.*)?$/i,
          ''
        )
        .trim();

    return (
      result ||
      null
    );
  }

  function extractPosterName(post) {
    /*
     * LinkedIn SDUI มี aria-label บอกเจ้าของโพสต์โดยตรง
     * ตัวนี้ดีกว่าดึงชื่อบรรทัดแรก เพราะอาจมี
     * "A ชอบสิ่งนี้" / "B รีโพสต์สิ่งนี้"
     */
    for (
      const button of
      post.querySelectorAll(
        'button[aria-label]'
      )
    ) {
      const label =
        button.getAttribute(
          'aria-label'
        ) || '';

      const thai =
        label.match(
          /เปิดเมนูควบคุมสำหรับโพสต์ของ\s+(.+)$/i
        );

      if (thai?.[1]) {
        return cleanPosterName(
          thai[1]
        );
      }

      const enBy =
        label.match(
          /(?:open|show).*(?:post by|post of|post from)\s+(.+)$/i
        );

      if (enBy?.[1]) {
        return cleanPosterName(
          enBy[1]
        );
      }

      const enPossessive =
        label.match(
          /(?:open|show).+for\s+(.+?)['’]s\s+post/i
        );

      if (enPossessive?.[1]) {
        return cleanPosterName(
          enPossessive[1]
        );
      }
    }

    /*
     * fallback:
     * profile/company link ที่อยู่ก่อน post body
     * และอยู่ใกล้ body ที่สุด
     */
    const body =
      post.querySelector(
        '[data-testid="expandable-text-box"]'
      );

    const links = [
      ...post.querySelectorAll(
        'a[href*="/in/"], a[href*="/company/"]'
      )
    ].filter(link => {
      if (!body) {
        return true;
      }

      return !!(
        link.compareDocumentPosition(
          body
        ) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    for (
      let i =
        links.length - 1;
      i >= 0;
      i--
    ) {
      const link =
        links[i];

      const candidate =
        cleanPosterName(
          S.textOf(link) ||
          link.getAttribute(
            'aria-label'
          )
        );

      if (
        candidate &&
        candidate.length <= 180
      ) {
        return candidate;
      }
    }

    return null;
  }

  function extractPosterProfileUrl(
    post,
    posterName
  ) {
    const body =
      post.querySelector(
        '[data-testid="expandable-text-box"]'
      );

    const links = [
      ...post.querySelectorAll(
        'a[href*="/in/"], a[href*="/company/"]'
      )
    ].filter(link => {
      if (!body) {
        return true;
      }

      return !!(
        link.compareDocumentPosition(
          body
        ) &
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    const target =
      posterName
        ?.normalize('NFKC')
        .toLowerCase();

    if (target) {
      for (
        let i =
          links.length - 1;
        i >= 0;
        i--
      ) {
        const link =
          links[i];

        const label =
          [
            S.textOf(link),
            link.getAttribute(
              'aria-label'
            ) || ''
          ]
            .join(' ')
            .normalize('NFKC')
            .toLowerCase();

        if (
          label.includes(
            target
          )
        ) {
          return link.href;
        }
      }
    }

    return (
      links[
        links.length - 1
      ]?.href ||
      null
    );
  }

  function hasDmIntent(text) {
    if (!text) {
      return false;
    }

    return (
      /(?:\bdm me\b|\bdm\b|\bdirect message\b|\bmessage me\b|\bmessage directly\b|\bvia dm\b|\binbox\b|\bsend me (?:a )?(?:dm|message)\b|ส่งข้อความ|ทัก(?:มา|ได้|หา)?|อินบ็อกซ์|inbox ได้)/i.test(
        text
      )
    );
  }

  function buildDmContact(
    text,
    post
  ) {
    if (
      !hasDmIntent(text)
    ) {
      return null;
    }

    const name =
      extractPosterName(
        post
      );

    const profileUrl =
      extractPosterProfileUrl(
        post,
        name
      );

    return {
      type:
        'linkedin_dm',

      name:
        name || null,

      profileUrl:
        profileUrl || null
    };
  }

  /* =======================================================
   * TITLE
   * ===================================================== */

  function extractTitle(text) {
    const lines =
      text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    const hiringLine =
      lines.find(line =>
        (
          /(?:hiring|open position|รับสมัคร|เปิดรับสมัคร)/i.test(
            line
          ) &&
          /(?:developer|engineer|programmer|software|backend|frontend|full.?stack|devops|project manager|business analyst|cloud|support|analyst)/i.test(
            line
          )
        ) &&
        line.length < 280
      );

    if (hiringLine) {
      return hiringLine;
    }

    const rolePattern =
      /\b(?:backend|back-end|frontend|front-end|full.?stack|developer|engineer|programmer|devops|software engineer|data engineer|qa engineer|project manager|business analyst|cloud engineer)\b/i;

    const title =
      lines.find(
        line =>
          rolePattern.test(
            line
          ) &&
          line.length < 250
      );

    return (
      title ||
      'LinkedIn Job Post'
    );
  }

  /* =======================================================
   * LOCATION
   * ===================================================== */

  function extractLocation(text) {
    const lines =
      text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    const labelled =
      lines.find(line =>
        /^(?:📍\s*)?(?:location|สถานที่(?:ทำงาน)?|work location)\s*[:：]/i.test(
          line
        )
      );

    if (labelled) {
      return labelled;
    }

    return (
      lines.find(line =>
        /\b(remote|hybrid|on-site|onsite|wfh)\b/i.test(
          line
        )
      ) ||
      null
    );
  }

  /* =======================================================
   * CONTRACT
   * ===================================================== */

  function extractContract(text) {
    if (!text) {
      return null;
    }

    const lines =
      text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    const labelled =
      lines.find(line =>
        /(?:contract(?:\s+(?:period|duration))?|employment\s+type|work\s+type|job\s+type|type|สัญญาจ้าง|สัญญา)\s*[:：-]?\s*.+/i.test(
          line
        ) &&
        /(?:contract|permanent|full[- ]?time|part[- ]?time|สัญญา|ประจำ)/i.test(
          line
        )
      );

    if (labelled) {
      return labelled;
    }

    return (
      lines.find(line =>
        /\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b.{0,45}\bcontract\b/i.test(
          line
        ) ||
        /\bcontract\b.{0,45}\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b/i.test(
          line
        ) ||
        /สัญญาจ้าง.{0,50}\d+\s*(?:วัน|สัปดาห์|เดือน|ปี)/i.test(
          line
        )
      ) ||
      null
    );
  }

  /* =======================================================
   * EMAIL
   * ===================================================== */

  function extractEmails(text) {
    if (!text) {
      return [];
    }

    const matches =
      text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
      ) || [];

    return [
      ...new Set(
        matches.map(value =>
          value
            .replace(
              /[),.;:]+$/g,
              ''
            )
            .toLowerCase()
        )
      )
    ];
  }

  /* =======================================================
   * CONTACTS
   * ===================================================== */

  function extractContacts(
    text,
    post
  ) {
    const contacts =
      new Set();

    const lines =
      text
        .split('\n')
        .map(x => x.trim())
        .filter(Boolean);

    for (
      const line of lines
    ) {
      if (
        /(?:line\s*(?:id)?|ไลน์)\s*[:：@]/i.test(
          line
        )
      ) {
        contacts.add(line);
      }

      if (
        /(?:whatsapp|telegram)\s*[:：]?/i.test(
          line
        )
      ) {
        contacts.add(line);
      }

      if (
        /(?:phone|mobile|tel|โทร|โทรศัพท์|contact)\s*[:：]?\s*\+?[\d\s()\-]{7,}/i.test(
          line
        )
      ) {
        contacts.add(line);
      }

      if (
        /^\+?\d[\d\s()\-]{7,}\d$/.test(
          line
        )
      ) {
        contacts.add(
          `Phone: ${line}`
        );
      }
    }

    if (
      hasDmIntent(text)
    ) {
      const name =
        extractPosterName(
          post
        );

      const profileUrl =
        extractPosterProfileUrl(
          post,
          name
        );

      if (name) {
        contacts.add(
          profileUrl
            ? `LinkedIn DM: ${name} | ${profileUrl}`
            : `LinkedIn DM: ${name}`
        );
      } else {
        contacts.add(
          'LinkedIn DM'
        );
      }
    }

    for (
      const a of
      post.querySelectorAll(
        'a[href]'
      )
    ) {
      const href =
        unwrapLinkedInRedirect(
          a.href
        );

      if (!href) {
        continue;
      }

      if (
        /^https?:\/\//i.test(
          href
        ) &&
        (
          /lnkd\.in/i.test(
            href
          ) ||
          /forms\.gle/i.test(
            href
          ) ||
          /docs\.google\.com\/forms/i.test(
            href
          ) ||
          /forms\.office\.com/i.test(
            href
          ) ||
          /apply/i.test(
            href
          ) ||
          /career/i.test(
            href
          ) ||
          /job/i.test(
            href
          )
        )
      ) {
        contacts.add(href);
      }
    }

    return [
      ...contacts
    ].slice(
      0,
      20
    );
  }

  /* =======================================================
   * IMAGES
   * ===================================================== */

  function extractImageUrls(post) {
    const urls =
      new Set();

    const accept =
      value => {
        if (!value) {
          return;
        }

        let url;

        try {
          url =
            new URL(
              value,
              location.origin
            ).href;
        } catch {
          return;
        }

        const lower =
          url.toLowerCase();

        if (
          !lower.startsWith(
            'http'
          )
        ) {
          return;
        }

        const excluded = [
          'profile-displayphoto',
          'profile-framedphoto',
          'company-logo',
          'company-background',
          'px.ads.linkedin.com',
          '/collect?',
          'static.licdn.com',
          'ghost-person',
          'ghost-company'
        ];

        if (
          excluded.some(token =>
            lower.includes(
              token
            )
          )
        ) {
          return;
        }

        if (
          lower.includes(
            'feedshare'
          ) ||
          lower.includes(
            'article-cover'
          ) ||
          lower.includes(
            'image-shrink_'
          ) ||
          lower.includes(
            'video-thumbnail'
          ) ||
          lower.includes(
            'media.licdn.com/dms/image/'
          )
        ) {
          urls.add(url);
        }
      };

    for (
      const img of
      post.querySelectorAll(
        'img'
      )
    ) {
      accept(
        img.currentSrc
      );

      accept(
        img.src
      );

      accept(
        img.getAttribute(
          'src'
        )
      );

      const srcset =
        img.getAttribute(
          'srcset'
        );

      if (srcset) {
        for (
          const part of
          srcset.split(',')
        ) {
          accept(
            part
              .trim()
              .split(/\s+/)[0]
          );
        }
      }
    }

    for (
      const video of
      post.querySelectorAll(
        'video[poster]'
      )
    ) {
      accept(
        video.getAttribute(
          'poster'
        )
      );
    }

    return [
      ...urls
    ].slice(
      0,
      20
    );
  }

  /* =======================================================
   * PARSE
   * ===================================================== */

  function parsePost(post) {
    const rawText =
      S.textOf(post);

    const text =
      rawText.normalize(
        'NFKC'
      );

    if (
      !rawText ||
      !looksLikeJobPost(
        text
      )
    ) {
      return null;
    }

    const postUrl =
      getPostUrl(post);

    const activityId =
      getActivityId(
        postUrl
      );

    const externalId =
      activityId
        ? `feed-${activityId}`
        : `feed-${S.hashString(
            rawText.slice(
              0,
              4000
            )
          )}`;

    const postedBy =
      extractPosterName(
        post
      );

    const posterProfileUrl =
      extractPosterProfileUrl(
        post,
        postedBy
      );

    const dmContact =
      buildDmContact(
        text,
        post
      );

    const emails =
      extractEmails(
        text
      );

    const contacts =
      extractContacts(
        text,
        post
      );

    const images =
      extractImageUrls(
        post
      );

    const contract =
      extractContract(
        text
      );

    return {
      source:
        'linkedin',

      externalId,

      postedBy,

      posterProfileUrl,

      dmContact,

      title:
        extractTitle(
          text
        ),

      company:
        null,

      location:
        extractLocation(
          text
        ),

      salaryText:
        S.extractSalary(
          text
        ),

      contractText:
        contract,

      contract,

      emails,

      email:
        emails,

      contacts,

      contact:
        contacts,

      imageUrls:
        images,

      images,

      description:
        rawText.slice(
          0,
          30000
        ),

      requirements:
        S.extractRequirements(
          text
        ),

      technologies:
        S.extractTechnologies(
          text
        ),

      jobUrl:
        postUrl ||
        location.href,

      postedAt:
        S.extractPostedAt(
          post
        )
    };
  }

  /* =======================================================
   * VISIBLE
   * ===================================================== */

  Feed.scanVisible =
    function () {
      const jobs =
        new Map();

      const posts =
        getPosts();

      console.log(
        '[FEED] posts:',
        posts.length
      );

      for (
        const post of posts
      ) {
        const job =
          parsePost(post);

        if (!job) {
          continue;
        }

        jobs.set(
          job.externalId,
          job
        );

        console.log(
          '[FEED] parsed',
          {
            title:
              job.title,

            postedBy:
              job.postedBy,

            dmContact:
              job.dmContact,

            contract:
              job.contractText,

            emails:
              job.emails,

            contacts:
              job.contacts,

            images:
              job.imageUrls.length
          }
        );
      }

      console.log(
        '[FEED] jobs visible:',
        jobs.size
      );

      return [
        ...jobs.values()
      ];
    };

  /* =======================================================
   * AUTO
   * ===================================================== */

  Feed.collectAll =
    async function (
      options = {}
    ) {
      const {
        maxRounds = 250,
        stagnantLimit = 10,
        scrollDelay = 650
      } = options;

      const root =
        getFeedRoot();

      if (!root) {
        console.warn(
          '[FEED] cannot start: root not found'
        );

        return [];
      }

      const jobs =
        new Map();

      let stagnant = 0;

      console.log(
        '[FEED] AUTO START',
        {
          url:
            location.href,
          initialPosts:
            getPosts().length,
          windowY:
            window.scrollY,
          documentHeight:
            document.documentElement
              .scrollHeight
        }
      );

      for (
        let round = 0;
        round < maxRounds;
        round++
      ) {
        /*
         * LinkedIn virtualizes the feed, so query DOM again
         * every round instead of holding old elements.
         */
        const beforePosts =
          getPosts();

        const beforeSignature =
          visiblePostSignature();

        const beforeJobCount =
          jobs.size;

        const current =
          Feed.scanVisible();

        const newJobs = [];

        for (
          const job of current
        ) {
          if (
            !jobs.has(
              job.externalId
            )
          ) {
            newJobs.push(job);
          }

          jobs.set(
            job.externalId,
            job
          );
        }

        /* Save progressively. */
        await S.saveJobs(
          newJobs
        );

        console.log(
          '[FEED] round',
          {
            round,
            visiblePosts:
              beforePosts.length,
            visibleJobs:
              current.length,
            newJobs:
              newJobs.length,
            totalJobs:
              jobs.size,
            stagnant
          }
        );

        await scrollFeedDown();

        await S.sleep(
          scrollDelay
        );

        const afterPosts =
          getPosts();

        const afterSignature =
          visiblePostSignature();

        const moved =
          beforeSignature !==
          afterSignature;

        const discovered =
          jobs.size >
          beforeJobCount;

        console.log(
          '[FEED] after scroll',
          {
            round,
            beforePosts:
              beforePosts.length,
            afterPosts:
              afterPosts.length,
            changed:
              moved,
            discovered,
            windowY:
              window.scrollY,
            documentHeight:
              document.documentElement
                .scrollHeight
          }
        );

        if (
          moved ||
          discovered
        ) {
          stagnant = 0;
        } else {
          stagnant++;
        }

        if (
          stagnant >=
          stagnantLimit
        ) {
          console.log(
            '[FEED] stop: feed did not change',
            {
              stagnant,
              totalJobs:
                jobs.size
            }
          );

          break;
        }
      }

      const result =
        [...jobs.values()];

      console.log(
        '[FEED] FINISHED',
        {
          total:
            result.length
        }
      );

      return result;
    };

  App.LinkedInFeed =
    Feed;
})();