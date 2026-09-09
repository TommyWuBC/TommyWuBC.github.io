// ---------------------------------------------------------------------------
// PROFILE DATA
// ---------------------------------------------------------------------------
// This is the single place to edit all site content: name, bio, projects,
// experience, education, skills, and contact links. Every component reads
// from this file — you should not need to touch any .astro file just to
// update your own information.
//
// Fields marked [PLACEHOLDER] should be replaced with real content/links.
// ---------------------------------------------------------------------------

export interface Link {
  label: string;
  url: string;
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
  intro:
    "I'm a Computer Science student at Georgia Tech building software across AI systems, robotics, and full-stack web applications. I enjoy turning research ideas and messy real-world data into reliable, well-engineered tools.",
};

export const about = `I'm Bingchang (Tommy) Wu, a Computer Science student at Georgia Tech studying Intelligence and Systems & Architecture. I like working across the stack — from training reinforcement learning agents and building RAG pipelines, to shipping the web apps and backend services that make that work usable by other people. Outside of class and research, I enjoy teaching (I TA'd Stanford's Code in Place), thinking about the practical and ethical questions around AI, and picking up new languages — I speak English and Chinese natively and am slowly learning Greek.`;

export const projects: Project[] = [
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
    title: 'BuzzBoard — Campus Event Discovery Platform',
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
    credential: 'B.S. in Computer Science — Threads: Intelligence, Systems & Architecture',
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
