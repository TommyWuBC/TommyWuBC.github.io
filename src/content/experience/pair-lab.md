---
role: Undergraduate Research Assistant
org: PAIR Lab, Georgia Tech
when: Jul 2026 to now
date: 2026-07-01
stack: [Python, PyTorch, Stable-Baselines3, MiniGrid]
projects: [visual-navigation]
sticker: { name: pair, width: 56, tilt: 7 }
---

- First project: visual navigation under distribution shift. Benchmarked five approaches; domain-randomized PPO, trained for 40M steps across three layout families, reached 100%, 98.4% and 97.8% success over 42, 249 and 276 layout patterns.
- Built an LLM-as-judge pipeline with a five-category spatial-reasoning taxonomy, and used it to classify 1,671 VLM reasoning steps across 40 navigation episodes.
- Made RL training 8&times; faster, from about 200 to 1,600 frames per second, by cutting redundant observation generation, running 8 environments in parallel and removing GPU overhead the job didn't need.
