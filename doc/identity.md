# IDENTITY.md: Thotsakan Statistic (ทศกัณฐ์ สถิติ)

> **"Stop Calculating. Start Simulating."**

## 1. The Core Vision
**Thotsakan Stat** is not a calculator. It is a **Virtual Statistics Laboratory**.

We reject the idea that statistics is about memorizing formulas. We believe statistics is about **intuition**. Our goal is to transform Thai university students from passive "listeners" into active "scientists" who can touch, break, and manipulate data to understand how the world works.

### The "Thotsakan" Metaphor
Just as the giant **Thotsakan** has 10 faces and 20 arms to see and control the world from every angle, our software gives students "10 Arms" to manipulate the variables of reality.

* **We do not give answers.** We give tools.
* **We do not check homework.** We test hypotheses.
* **We do not lecture.** We let students fail safely.

---

## 2. Our Identity: The "10-Armed Laboratory"

We are **Option 2: The Sandbox**.

| **We Are...** | **We Are NOT...** |
| :--- | :--- |
| **A Sandbox** where you break things to learn. | **A Textbook** with a single correct path. |
| **A Simulator** (Monte Carlo, Bootstrapping). | **A Calculator** (Input X, Get Y). |
| **Budget-Based** (You have limited samples). | **Infinite** (Real science has costs). |
| **Visual First** (Graphs before numbers). | **Formula First** (Greek letters scare people). |
| **Thai-Contextualized** (Lotto, PM2.5, Grab). | **Western-Imported** (Baseball stats, Dice). |

---

## 3. The User Experience (UX) Pillars

Every screen in Thotsakan Stat must feel like a **Lab Bench**, not a quiz. It follows the **"Control-Observe-Log"** loop:

### A. The Control Room (Thotsakan's Hands)
* **The Input:** Never just a text box. Use **Sliders, Knobs, and Toggles**.
* **The Constraint:** The "Budget." Real science costs money.
    * *Example:* "You have 1,000 Baht. Each sample costs 10 Baht. Can you prove the vaccine works before you run out of money?"
* **The Feeling:** Tactile, responsive, heavy.

### B. The Observation Deck (Thotsakan's Eyes)
* **The Output:** **Instant visualization.** If a student moves a slider, the graph updates *immediately* ( < 100ms).
* **The Rule:** "Show, Don't Tell." Don't show the P-value number until the student sees the "Rejection Region" turn red on the graph.
* **The Tech:** Powered by **Reflex (React)** for smooth, app-like performance, not static page reloads.

### C. The Lab Notebook (Thotsakan's Brain)
* **The Reflection:** We don't grade them. We ask them to log their findings.
* **The Prompt:** *"You increased the sample size to 10,000. Why did the curve get narrower?"*

---

## 4. The Technical Architecture

To support the "Lab" identity, we prioritize **Interactivity** over everything else.

* **Frontend:** **React + TypeScript + Vite**.
    * *Why:* Full SPA with instant slider feedback. JS computes quick approximations for that "alive" feeling — the lab bench responds before you lift your finger.
* **Backend:** **FastAPI + Python** (scipy, statsmodels, pingouin).
    * *Why:* The "Engine" that calculates the simulation must be scientifically accurate. Python is the authority — the professor reads and verifies `core/` directly.
* **Visualization Engine:** **Plotly**.
    * *Why:* Interactive hovering, zooming, and panning are mandatory. Static images (Matplotlib) are forbidden in the Lab.
* **The Pattern:** Thin client + authoritative server.
    * *Why:* Students get instant visual feedback (JS), backed by Python precision. The best of both worlds — responsive UI with verifiable math.

---

## 5. Target Audience & Tone

### Who is this for?
1.  **The "Visual Learner" University Student:** The student who fails because they can't read Greek notation but understands patterns instantly when they see them.
2.  **The "Modern" Professor:** The lecturer who wants to project a simulation on the whiteboard instead of drawing a bad curve by hand.

### Tone of Voice
* **Scientific but Accessible:** We use correct terms (Variance, Stdev) but explain them simply.
* **Challenging:** We don't say "Good job!" We say "Hypothesis Confirmed."
* **Thai-Native:** We speak to the Thai experience. We use data from *our* world.

---

## 6. The "Anti-Features" (What we will NEVER build)
* **Photo-Solver:** We will never build a tool that lets students take a picture of a homework problem to get the answer. That destroys the "Lab."
* **Multiple Choice Quizzes:** Real life is not A, B, C, or D. It is a continuous variable.
* **Static Text Walls:** If it takes more than 3 sentences to explain, build a simulation for it instead.

---

*This document is the law. If a feature does not fit the "10-Armed Lab" identity, we do not build it.*