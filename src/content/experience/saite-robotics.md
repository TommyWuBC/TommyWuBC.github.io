---
role: Software Engineering Intern
org: Saite Robotics
when: May to Aug 2026
date: 2026-05-15
stack: [Python, FastAPI, PostgreSQL, ROS, LangChain, Chroma]
projects: [fault-diagnosis]
figure:
  value: "~80%"
  caption: Less manual fault-triage time. Retrieval finds the right guidance in the top 3 results 93% of the time.
sticker: { name: saite, width: 52, tilt: -6 }
---

- Deployed an internal diagnostic platform that turns a robot's ROS logs into fault reports a technician can act on: deterministic subsystem diagnosis first, LLM analysis on top, a rule-based fallback underneath. Centralized telemetry; recovery survives a reboot.
- Grounded the generated reports in maintenance guidance with a RAG pipeline: 93% top-3 retrieval accuracy.
