// ---------------------------------------------------------------------------
// Identity, links and the About section. Projects, jobs and notes live in
// src/content/ instead (see src/content.config.ts).
// ---------------------------------------------------------------------------

export const site = {
  name: 'Tommy Wu',
  fullName: 'Bingchang Wu',
  url: 'https://tommywubc.github.io',
  description:
    'Bingchang (Tommy) Wu studies computer science at Georgia Tech and works on reinforcement learning, LLM systems and the web.',
  /** The cover paragraph under the name. */
  dek: 'Bingchang Wu, Tommy to most people. I study computer science at Georgia Tech and work on reinforcement learning, LLM systems and the web, usually on problems where you can measure whether it worked.',
  email: 'bwu368@gatech.edu',
  github: 'https://github.com/TommyWuBC',
  linkedin: 'https://www.linkedin.com/in/bingchang-wu-017474274',
  resume: '/resume.pdf',
  location: 'Atlanta, GA',
};

/** Short facts on the cover. */
export const facts: { label: string; value: string }[] = [
  { label: 'Now', value: 'Research assistant, PAIR Lab' },
  { label: 'Studying', value: 'B.S. Computer Science, Georgia Tech' },
  { label: 'Threads', value: 'Intelligence; Systems & Architecture' },
];

/** About section paragraphs. The first is set larger. HTML entities are fine. */
export const about: string[] = [
  'I grew up speaking English and Chinese, did A-Levels at Dulwich College, and came to Georgia Tech in 2025 to study computer science.',
  'Most of what I build starts as a question I want a number for. Does the agent still work when the layout changes? Does retrieval find the right page? How long does a query take on a real codebase? I would rather write 91.7% than &#8220;highly accurate&#8221;.',
  'In 2025 I was a section leader for Stanford&#8217;s Code in Place, teaching Python to a group of fifteen.',
  'Away from a keyboard I would rather be outside, preferably somewhere with a lot of sky.',
];

export const education: string[] = [
  'Georgia Tech, B.S. Computer Science, since 2025. GPA 4.0.',
  'Dulwich College, A-Levels, 2023 to 2025.',
];

export const honors: string[] = [
  'Gold award, British Physics Olympiad, Round 1.',
  'Fellow, &#8220;Dilemmas and Dangers in AI&#8221;, Leaf, 2024.',
];

export const languages = 'English and Chinese, both native. Elementary Greek.';

export const skills: { label: string; items: string }[] = [
  { label: 'Programming', items: 'Python, Java, TypeScript, JavaScript, C, C++, SQL.' },
  {
    label: 'Machine learning',
    items:
      'PyTorch, Stable-Baselines3, reinforcement learning (PPO), vision-language models, RAG, Hugging Face, LangChain, LangGraph.',
  },
  { label: 'Web', items: 'Next.js, React, Express, FastAPI, Streamlit.' },
  {
    label: 'Infrastructure and data',
    items: 'Git, Docker, Linux, ROS, Playwright. PostgreSQL, SQLite, Chroma, Firebase, AWS, Vercel, Cloudflare.',
  },
];

export const coursework =
  'Data Structures &amp; Algorithms, Object-Oriented Programming, Computer Organization, Discrete Math, Linear Algebra, Objects &amp; Design.';
