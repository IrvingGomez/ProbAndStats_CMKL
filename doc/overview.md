# OVERVIEW.md: Thotsakan Stat (The 10-Armed Laboratory)

> **Project Code:** THOTSAKAN-LAB
> **Core Philosophy:** "Stop Calculating. Start Simulating."

## 1. The Concept
**Thotsakan Stat** is a web-based **Virtual Statistics Laboratory** built for Thai university students. It replaces the traditional "Calculator" approach with an **"Experimental"** approach.

Instead of typing numbers to get an answer, students use **"Thotsakan's 10 Arms"** (sliders, knobs, toggles) to manipulate variables in real-time and watch how the data universe changes.

---

## 2. The User Interface (The Lab Bench)
The application follows a strict **3-Panel "Lab Bench" Layout**. It does not look like a standard website; it looks like a cockpit or a scientific instrument.

### A. The Control Room (Thotsakan's Hands)
* **The Input Strategy:** "Coarse & Fine Control."
    * Every variable (e.g., Mean) must have:
        1.  **A Slider:** For exploring behavior (Coarse adjustment).
        2.  **A Text Input:** For typing exact homework values (Fine adjustment).
* **The Interaction:** These two must be **synced**. If you type "5.5", the slider jumps to the middle. If you drag the slider, the numbers in the box change.

### B. The Observation Deck (Thotsakan's Eyes)
* **The Output:** **Instant visualization.** If a student moves a slider, the graph updates *immediately* ( < 100ms).
* **The Rule:** "Show, Don't Tell." Don't show the P-value number until the student sees the "Rejection Region" turn red on the graph.
* **The Tech:** Powered by **Reflex (React)** for smooth, app-like performance, not static page reloads.

### 📐 Visual Layout (Wireframe)

```text
+---------------------+------------------------------------------+----------------------+
|  PANEL 1: CONTROLS  |         PANEL 2: OBSERVATION DECK        |   PANEL 3: NOTEBOOK  |
|  (Thotsakan's Hands)|            (Thotsakan's Eyes)            |  (Thotsakan's Brain) |
|                     |                                          |                      |
|  [ Slider: Mean   ] |                                          |  [   BIG STATS    ]  |
|  <----O--------->   |           /  ( The Curve ) \            |    Prob: 95.4%       |
|                     |          /                  \           |    Z-Score: 1.96     |
|  [ Slider: StDev  ] |         /                    \          |                      |
|  <-------O------>   |  ______/                      \______   |  ------------------  |
|                     |                                          |  [   THE LESSON   ]  |
|  [ Toggle: Mode   ] |      ( Interactive Plotly Graph )        |  "Notice how the     |
|  ( ) PDF  (x) CDF   |                                          |   tails get thinner  |
|                     |                                          |   as you increase    |
|  [  RESET BUTTON  ] |                                          |   sample size?"      |
|                     |                                          |                      |
+---------------------+------------------------------------------+----------------------+