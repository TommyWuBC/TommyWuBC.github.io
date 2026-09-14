// ---------------------------------------------------------------------------
// PROFILE DATA
// ---------------------------------------------------------------------------
// This is the single place to edit all site content: name, bio, projects,
// experience, education, skills, and contact links. Every component reads
// from this file, so you should not need to touch any .astro file just to
// update your own information.
//
// Fields marked [PLACEHOLDER] should be replaced with real content/links.
// ---------------------------------------------------------------------------

export interface Link {
  label: string;
  url: string;
}

export interface UserStory {
  id: number;
  role: 'user' | 'admin';
  story: string;
  feature: string;
}

export interface VideoDemo {
  /**
   * YouTube/Vimeo URL, direct embed URL, or a path to a file in /public
   * (e.g. '/videos/demo.mp4'). Leave as '' until the recording is ready;
   * the project page shows a "coming soon" placeholder until then.
   */
  url: string;
  caption?: string;
}

export interface Project {
  slug: string;
  title: string;
  summary: string;
  description: string[];
  tech: string[];
  metrics?: string[];
  org?: string;
  dates?: string;
  links: Link[];
  /** Set to true if you have a real image at /public/projects/<slug>.jpg */
  hasImage?: boolean;
  /** Maps required user stories to the screen/feature that implements each one. */
  userStories?: UserStory[];
  /** Paragraphs describing methodology/approach and how doubts were resolved. */
  process?: string[];
  video?: VideoDemo;
}

export interface ExperienceEntry {
  role: string;
  org: string;
  location?: string;
  dates: string;
  bullets: string[];
}

export interface EducationEntry {
  school: string;
  credential: string;
  dates: string;
  details?: string[];
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export const site = {
  name: 'Bingchang Wu',
  shortName: 'Tommy Wu',
  headline: 'Computer Science Student & Software Engineer',
  location: 'Atlanta, GA',
  email: 'bwu368@gatech.edu',
  github: 'https://github.com/TommyWuBC',
  linkedin: 'https://www.linkedin.com/in/bingchang-wu-017474274',
  resumeUrl: '/resume.pdf',
  photo: '/profile.jpg',
  intro:
    "I'm a Computer Science student at Georgia Tech building software across AI systems, robotics, and full-stack web applications. I enjoy turning research ideas and messy real-world data into reliable, well-engineered tools.",
};

export const about = `I'm Bingchang (Tommy) Wu, a Computer Science student at Georgia Tech studying Intelligence and Systems & Architecture. I like working across the stack, from training reinforcement learning agents and building RAG pipelines, to shipping the web apps and backend services that make that work usable by other people. Outside of class and research, I enjoy teaching (I TA'd Stanford's Code in Place), thinking about the practical and ethical questions around AI, and picking up new languages: I speak English and Chinese natively and am slowly learning Greek.`;

export const projects: Project[] = [
  {
    slug: 'gt-movies-store',
    title: 'GT Movies Store',
    summary:
      'A full-stack Django movie storefront built for CS 2340: account management, a searchable catalog, a session-based cart and checkout, user reviews with moderation, and a Django-admin back office, deployed live on PythonAnywhere.',
    description: [
      "GT Movies Store is an online movie shop built as the term project for Georgia Tech's CS 2340 (Objects & Design). Users can register an account, browse and search the movie catalog, view movie details, add movies to a shopping cart, check out to build an order history, and leave reviews on movies to help other shoppers decide what to buy.",
      "The app is split into four Django apps by responsibility: home (landing/about pages), accounts (signup, login, logout, order history), movies (catalog, movie detail, reviews), and cart (session-based cart and checkout). Each app owns its own models, views, URLs, and templates, which kept the 21 required user stories easy to trace back to a single, obvious place in the codebase.",
      'Every page extends one shared Bootstrap 5 base template with a collapsible responsive navbar and a grid-based footer, so the same interface works from a widescreen monitor down to a phone without a separate mobile build. Authentication state (logged in vs. logged out) drives which nav links and page actions are shown.',
      "Every model (users, movies, reviews, orders, and order line items) is registered with Django's built-in admin site, giving an administrator full create/view/update/delete control over the store's data without any custom admin UI code.",
      "The one feature not covered directly by the course template is review moderation: reviews carry a `reported` boolean that any signed-in user (other than the reviewer) can flip via a 'Report' button, and the movie-detail view filters those reviews out of the page from that point on.",
    ],
    tech: ['Python', 'Django 5', 'SQLite', 'Bootstrap 5', 'HTML/CSS', 'PythonAnywhere'],
    org: 'Georgia Institute of Technology, CS 2340: Objects & Design',
    dates: 'Fall 2026',
    links: [
      { label: 'Live Site', url: 'https://bwu.pythonanywhere.com/' },
      { label: 'GitHub', url: 'https://github.com/TommyWuBC/CS2340-Project1' },
    ],
    userStories: [
      {
        id: 1,
        role: 'user',
        story:
          'As a user, I want to see information about the GT Movies Store so I can learn more about the app and its purpose.',
        feature: "Home → About page, a static overview of the store's purpose, reachable from the nav bar on every page.",
      },
      {
        id: 2,
        role: 'user',
        story: 'As a user, I want to register an account so that I can access the GT Movies Store.',
        feature: "Accounts → Sign Up page, built on Django's UserCreationForm with a custom form/error styling.",
      },
      {
        id: 3,
        role: 'user',
        story: 'As a registered user, I want to log in so that I can access my account data.',
        feature: "Accounts → Log In page, using Django's authenticate()/login() with an inline error message on bad credentials.",
      },
      {
        id: 4,
        role: 'user',
        story:
          'As a user, I want to be able to view the list of movies available in the GT Movies Store so I can make my selections.',
        feature: 'Movies → Catalog page lists every movie in the database as a grid of cards.',
      },
      {
        id: 5,
        role: 'user',
        story: 'As a user, I want to search movies per title so I can make my selections.',
        feature: 'A search bar on the catalog page filters movies by title (case-insensitive partial match) via a query parameter.',
      },
      {
        id: 6,
        role: 'user',
        story:
          'As a user, I want to be able to access a shopping cart so I can list all movie items I am willing to purchase.',
        feature: 'Cart page reads a session-based cart and lists every movie currently added, with a running total.',
      },
      {
        id: 7,
        role: 'user',
        story:
          'As a user, I want to be able to add one or more items of a movie to my shopping cart so I can purchase them in the future.',
        feature: "Movie detail page's 'Add to cart' form lets a user pick a quantity (1–10) and adds it to the session cart.",
      },
      {
        id: 8,
        role: 'user',
        story: 'As a user, I want to create movie reviews so others can use my insights when searching for movies.',
        feature: "Movie detail page includes a 'Create a review' form for signed-in users, posting a comment tied to that movie and user.",
      },
      {
        id: 9,
        role: 'user',
        story:
          'As a user, I want to be able to remove all movie items from my shopping cart so I can have flexibility on what I purchase or not.',
        feature: "'Clear cart' action on the cart page empties the session cart in one click.",
      },
      {
        id: 10,
        role: 'user',
        story: 'As a user, I want to edit my reviews so I have the freedom to change my mind about my reviews.',
        feature: "'Edit' button shown only on a review the current user owns, opening an edit form pre-filled with the existing comment.",
      },
      {
        id: 11,
        role: 'user',
        story: 'As a user, I want to delete my movie reviews so I have the freedom to change my mind about my reviews.',
        feature: "'Delete' button shown only on a review the current user owns, removing it immediately.",
      },
      {
        id: 12,
        role: 'user',
        story:
          'As a user, I want to see the reviews of a movie so I can have information on whether I should purchase a movie or not.',
        feature: 'Movie detail page lists all non-reported reviews for that movie, newest activity visible with author and date.',
      },
      {
        id: 13,
        role: 'user',
        story: 'As a user, I want to see the details of a movie so I have the information to make my choices.',
        feature: 'Movie detail page shows the poster, name, price, and full description for a single movie.',
      },
      {
        id: 14,
        role: 'user',
        story: 'As a user, I want to see a list of my orders so I can track what I have purchased and my expenses.',
        feature: "Accounts → Orders page lists every past order for the signed-in user, pulled from their order history.",
      },
      {
        id: 15,
        role: 'user',
        story:
          'As a user, I want to be able to access the GT Movies Store from any desktop using a web browser, so I can use the app anywhere with an internet connection.',
        feature: 'The app is deployed live at bwu.pythonanywhere.com, reachable from any desktop browser with an internet connection.',
      },
      {
        id: 16,
        role: 'user',
        story:
          'As a user, I want the GT Movies Store to feature a responsive Graphical User Interface (GUI) so I can access it through different devices with diverse screen sizes.',
        feature: 'A shared Bootstrap 5 base template with a collapsible navbar and responsive grid columns adapts the layout from desktop to mobile widths.',
      },
      {
        id: 17,
        role: 'admin',
        story:
          'As an administrator, I want to be able to manage (view, create, update, or delete) users from the GT Movies Store so we can keep information up to date.',
        feature: "Django Admin (/admin/) exposes the built-in User model for full create/view/update/delete access.",
      },
      {
        id: 18,
        role: 'admin',
        story:
          'As an administrator, I want to be able to manage (view, create, update, or delete) movies from the GT Movies Store so we can keep information up to date.',
        feature: 'Django Admin registers a custom MovieAdmin (searchable, sorted by name) for full CRUD on the movie catalog.',
      },
      {
        id: 19,
        role: 'admin',
        story:
          'As an administrator, I want to be able to manage (create, update, or delete) reviews from the GT Movies Store so we can keep information up to date.',
        feature: 'Django Admin registers the Review model, so staff can create, edit, or remove any review directly.',
      },
      {
        id: 20,
        role: 'admin',
        story:
          'As an administrator, I want to be able to manage (create, update, or delete) orders from the GT Movies Store so we can keep information up to date.',
        feature: 'Django Admin registers both the Order and Item models, so staff can manage orders and their line items directly.',
      },
      {
        id: 21,
        role: 'user',
        story:
          "As a user, I want to report inappropriate reviews so that the comment section isn't cluttered with irrelevant/offensive reviews and the review is removed from the page moving forward.",
        feature: "A 'Report' button on any review that isn't the viewer's own sets a `reported` flag; the movie detail page excludes reported reviews going forward.",
      },
    ],
    process: [
      "I worked through this project mostly sequentially, using the chapter structure of Django 5 for the Impatient (Correa & Lim) as a rough roadmap: get the project skeleton and home app running first, then layer in accounts/auth, then the movies catalog, then reviews, then cart and checkout, testing each user story in the browser before moving on so I always had a working app rather than a half-finished one.",
      "Before writing code, I grouped the 21 user stories by which Django app would own them (home, accounts, movies, cart), since Django expects a project to be sliced into apps by responsibility rather than by page. That grouping made it obvious which app should own which models, views, and URLs, and kept later debugging localized to one app at a time.",
      "When I hit an error or wasn't sure how a Django feature worked (session-based carts, login_required, ForeignKey cascade behavior, wiring up the admin site), I'd start with the official Django documentation for the exact API, then cross-check GeeksforGeeks or W3Schools when I wanted a simpler explanation or a runnable example, and come back to the book for how the pieces fit together in this specific project's structure.",
      "The review-reporting feature (user story #21) isn't covered in the book, so I extended the Review model with a boolean `reported` field and filtered it out of the query used by the movie detail view, the same pattern the book uses elsewhere for flags on a model, applied to a new case.",
      'I deployed to PythonAnywhere early rather than waiting until the end, so every feature after that point was tested against the real deployment target and not just the local dev server.',
    ],
    video: {
      url: '/videos/gt-movies-store-demo.mp4',
      caption:
        'Full walkthrough: account signup/login, browsing and searching the catalog, cart and checkout, creating/editing/deleting/reporting reviews, and the Django admin panel.',
    },
  },
  {
    slug: 'autonomous-vehicle-diagnostics',
    title: 'Autonomous-Vehicle Fault Diagnosis Platform',
    summary:
      'An internal platform that turns large ROS log files into structured, technician-ready diagnostic reports, combining deterministic subsystem diagnosis with LLM-generated analysis and a rule-based fallback.',
    description: [
      'Built and deployed an internal autonomous-vehicle fault-diagnosis and reporting platform for technical teams, designed to turn large ROS log files into structured, technician-ready diagnostic reports.',
      'The system combined deterministic subsystem diagnosis with LLM-generated analysis and rule-based fallback, and was deployed on a company Ubuntu VM for internal LAN access.',
      'Developed the supporting production stack with centralized telemetry, persistent services via systemd, and automated report generation.',
      'Later extended the platform with a RAG-based workflow using LangChain, LangGraph, Hugging Face embeddings, and Chroma to retrieve relevant maintenance knowledge and ground generated reports with supporting context and citations.',
    ],
    tech: [
      'Python',
      'FastAPI',
      'PostgreSQL',
      'SQLite',
      'Streamlit',
      'Playwright',
      'systemd',
      'LangChain',
      'LangGraph',
      'Hugging Face',
      'Chroma',
      'Ubuntu',
    ],
    metrics: [
      '~80% reduction in manual fault-triage time',
      '93% top-3 retrieval accuracy for grounded report citations',
    ],
    org: 'Saite Robotics',
    dates: 'May 2026 – Aug 2026',
    links: [{ label: 'Code (internal/private)', url: '[PLACEHOLDER]' }],
  },
  {
    slug: 'carla-behavior-trees',
    title: 'CARLA Behavior-Tree Simulation Nodes',
    summary:
      'Six reusable Python behavior-tree nodes for CARLA autonomous-driving simulations, covering trajectory generation, path matching, obstacle classification, and collision-risk detection.',
    description: [
      'Developed six Python behavior-tree nodes for CARLA simulations, including configurable trajectory generation, path matching, obstacle classification, collision-risk detection, and reusable geometry utilities.',
    ],
    tech: ['Python', 'CARLA', 'ROS'],
    metrics: ['0.31 m average path deviation across 24 test scenarios'],
    org: 'Saite Robotics',
    dates: 'May 2026 – Aug 2026',
    links: [{ label: 'Code (internal/private)', url: '[PLACEHOLDER]' }],
  },
  {
    slug: 'visual-navigation-research',
    title: 'Visual-Navigation Reinforcement Learning Research',
    summary:
      'A controlled study comparing five visual-navigation approaches, plus an LLM-as-judge pipeline for evaluating spatial reasoning in vision-language models.',
    description: [
      'Conducted a controlled visual-navigation study comparing five approaches: single-environment PPO, domain-randomized PPO, behavior cloning with DAgger, zero-shot GPT-4o-mini, and BFS.',
      'Trained domain-randomized PPO across three layout families, achieving 100%, 98.4%, and 97.8% success across 42, 249, and 276 evaluated layout patterns after 40M training steps.',
      'Built an LLM-as-judge pipeline using a five-category spatial-reasoning taxonomy to classify 1,671 VLM reasoning steps across 40 navigation episodes.',
      'Increased RL training throughput 8x, from ~200 to ~1600 FPS, by eliminating redundant observation generation, parallelizing 8 environments, and removing unnecessary GPU overhead.',
    ],
    tech: [
      'Python',
      'PyTorch',
      'Stable-Baselines3',
      'Reinforcement Learning',
      'Vision-Language Models',
      'NumPy',
      'pandas',
    ],
    org: 'PAIR Lab, Georgia Institute of Technology',
    dates: 'May 2026 – Present',
    links: [{ label: 'Code (in progress)', url: '[PLACEHOLDER]' }],
  },
  {
    slug: 'buzzboard',
    title: 'BuzzBoard: Campus Event Discovery Platform',
    summary:
      'A full-stack campus event-discovery platform with real-time RSVP and presence updates, proximity-aware feed ranking, and schedule-conflict detection.',
    description: [
      'Contributed to a full-stack campus event-discovery platform supporting 500+ campus events, built with the GT Web Dev Club.',
      'Engineered real-time RSVP, friendship, and presence updates using Firestore listeners with optimistic UI updates for instant client-side feedback.',
      'Designed a proximity-aware feed-ranking algorithm and schedule-conflict detection system, with Leaflet maps and ICS calendar import.',
    ],
    tech: ['Next.js', 'TypeScript', 'Express', 'Firebase', 'Firestore', 'Leaflet'],
    org: 'GT Web Dev Club',
    dates: 'Jan 2026 – May 2026',
    links: [
      { label: 'GitHub', url: '[PLACEHOLDER]' },
      { label: 'Live site', url: '[PLACEHOLDER]' },
    ],
  },
];

export const experience: ExperienceEntry[] = [
  {
    role: 'Software Engineering Intern',
    org: 'Saite Robotics',
    dates: 'May 2026 – Aug 2026',
    bullets: [
      'Deployed an internal diagnostic platform that converted ROS logs into technician-ready fault reports, reducing manual fault-triage time by ~80%.',
      'Built the FastAPI/Streamlit application with PostgreSQL, centralized telemetry, and systemd-managed recovery across VM reboots.',
      'Integrated RAG into report generation using LangChain, LangGraph, Hugging Face embeddings, and Chroma, grounding reports in maintenance guidance and achieving 93% top-3 retrieval accuracy.',
      'Developed 6 Python behavior-tree nodes for a separate CARLA simulation task, supporting trajectory evaluation and collision-risk detection while averaging 0.31 m path deviation across 24 scenarios.',
    ],
  },
  {
    role: 'Undergraduate Research Assistant',
    org: 'PAIR Lab, Georgia Institute of Technology',
    dates: 'May 2026 – Present',
    bullets: [
      'Conducted a controlled visual-navigation study comparing five approaches: single-environment PPO, domain-randomized PPO, behavior cloning with DAgger, zero-shot GPT-4o-mini, and BFS.',
      'Trained domain-randomized PPO across three layout families, achieving 100%, 98.4%, and 97.8% success across 42, 249, and 276 evaluated layout patterns after 40M steps.',
      'Built an LLM-as-judge pipeline using a five-category spatial-reasoning taxonomy to classify 1,671 VLM reasoning steps across 40 navigation episodes.',
      'Increased RL training throughput 8x from ~200 to ~1600 FPS by eliminating redundant observation generation, parallelizing 8 environments, and removing unnecessary GPU overhead.',
    ],
  },
  {
    role: 'Section Leader (TA)',
    org: 'Stanford University, Code in Place',
    dates: 'Apr 2025 – Jun 2025',
    bullets: [
      "Selected to teach Python to a cohort of 15 students in Stanford's globally scaled Code in Place course serving 16,000+ learners.",
      'Led weekly live sections and office hours covering control flow, functions, loops, and data structures through beginner-friendly mental models and hands-on debugging.',
      'Mentored students one-on-one on problem-solving strategies and project development while adapting pacing for varied experience levels.',
    ],
  },
  {
    role: 'Fellow, "Dilemmas and Dangers in AI"',
    org: 'Leaf Courses',
    dates: 'Jul 2024 – Sep 2024',
    bullets: ['Fellowship exploring practical and ethical dilemmas in artificial intelligence.'],
  },
];

export const education: EducationEntry[] = [
  {
    school: 'Georgia Institute of Technology',
    credential: 'B.S. in Computer Science, Threads: Intelligence, Systems & Architecture',
    dates: 'Aug 2025 – May 2028 (expected)',
    details: [
      'GPA: 4.0 / 4.0',
      'Relevant coursework: Data Structures & Algorithms, Object-Oriented Programming, Computer Organization & Programming, Discrete Mathematics, Linear Algebra, Objects & Design (Software Engineering)',
    ],
  },
  {
    school: 'Dulwich College',
    credential: 'A-Level',
    dates: 'Aug 2023 – Jun 2025',
  },
  {
    school: "Queen Ethelburga's Collegiate",
    credential: 'GCSE',
    dates: 'Sep 2021 – Jun 2023',
  },
  {
    school: "Foley's School",
    credential: 'Middle School Diploma',
    dates: 'Sep 2019 – Jun 2021',
  },
];

export const honors: string[] = [
  'Code in Place Section Leader certification',
  'Fellowship, "Dilemmas and Dangers in AI" program',
  'Gold award, British Physics Olympiad (BPhO) Round 1',
];

export const skills: SkillCategory[] = [
  {
    category: 'Languages',
    items: ['Python', 'Java', 'TypeScript', 'JavaScript', 'C', 'C++', 'SQL', 'HTML/CSS'],
  },
  {
    category: 'AI / ML',
    items: [
      'PyTorch',
      'Stable-Baselines3',
      'NumPy',
      'pandas',
      'scikit-learn',
      'MiniGrid',
      'Reinforcement Learning (PPO)',
      'Vision-Language Models',
      'Retrieval-Augmented Generation (RAG)',
      'Hugging Face',
      'LangChain',
      'LangGraph',
    ],
  },
  {
    category: 'Frameworks',
    items: ['Next.js', 'React', 'Express', 'FastAPI', 'Streamlit', 'Leaflet'],
  },
  {
    category: 'Developer Tools',
    items: ['Git', 'Docker', 'Linux (Ubuntu)', 'ROS', 'Playwright'],
  },
  {
    category: 'Databases & Cloud',
    items: ['PostgreSQL', 'SQLite', 'Chroma', 'Firebase', 'AWS', 'Vercel', 'Cloudflare'],
  },
  {
    category: 'Spoken Languages',
    items: ['English (Native)', 'Chinese (Native)', 'Greek (Elementary)'],
  },
];
