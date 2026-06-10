# Data Tab UX/UI Review: Scaling for Large Datasets

## Overview
While the current Data Tab implementation is clean and effective for small-to-medium datasets, it presents several severe usability and performance bottlenecks when handling "large scale" data (e.g., datasets with 100+ columns, high-cardinality categorical data, or millions of rows). 

Below is a breakdown of the current UX constraints and strategic recommendations to refine the interface for enterprise-grade or research-heavy workloads.

---

## 1. Column Type Reclassification (The "Wall of Chips")
### Current State
The UI maps over all headers and renders a flex-wrapped toggle button (`<button>`) for each column to switch between numerical and categorical.
**The Problem:** If a dataset has 100+ or 500+ columns, this becomes an unusable, overwhelming wall of chips that consumes the entire viewport.

### Recommendations
* **Searchable List / Data Grid:** Move from a flat wrap layout to a fixed-height, scrollable, and virtualized list. 
* **Search Input:** Add a quick "Search columns..." text input to filter the list of columns instantly.
* **Bulk Actions:** Add functionality to select multiple columns (checkboxes) to reclassify them in one click (e.g., "Set all selected to Categorical").
* **Group by Type:** Divide the view into a "Numeric Columns" and "Categorical Columns" dual-list layout so users can easily see current assignments.

---

## 2. Category Filters (Cardionality & Limit Constraints)
### Current State
It arbitrarily limits editable filters to the first 3 categorical columns (`slice(0, 3)`). Worse, it renders an inline toggle button for *every unique value*. 
**The Problem:** If users need to filter by the 4th column, they can't. If a column has 1,000+ unique values (e.g., Zip Codes, Names), rendering 1,000 buttons will severely lag the DOM and ruin the UX.

### Recommendations
* **Dynamic Filter Builder:** Remove the hardcoded inline lists. Replace it with an "Add Filter" button that spawns a systematic rule builder (e.g., `[Select Column] -> [Select Operator] -> [Select/Type Value]`).
* **Combobox Dropdowns:** For selecting categorical values, use a searchable dropdown/combobox with virtualization (e.g., `react-select` or similar) instead of mapping all choices as inline buttons.
* **Frequency Visibility:** If inline lists are kept, only display the "Top 5 most frequent" values as chips, keeping the rest tucked behind a `<Search for more...>` input.

---

## 3. Data Preview Table (Exploration Limitations)
### Current State
Hardcoded to only show the first 50 rows (`filteredRows.slice(0, 50)`). Additionally, it renders every single column, no matter how many there are.
**The Problem:** Users have no ability to traverse rows 51+. Furthermore, horizontally scrolling past 50 columns without a sticky reference point causes users to lose context completely.

### Recommendations
* **Pagination / Virtualization:** Add a standard pagination footer (Rows per page, Next, Prev, Last) or implement a virtual scroll library (like `@tanstack/react-virtual`) to allow smooth scrolling through 10,000+ rows.
* **Column Visibility Manager:** Add a standard "View Columns" dropdown to let users hide/show columns. Showing 150 columns is rarely useful; letting users select the 10 they care about is much better.
* **Sticky Context:** Ensure the table `<thead>` is sticky for vertical scrolling, and make the `#` (index) or an identifier column sticky for horizontal scrolling.

---

## 4. File Upload & Processing State
### Current State
Displays an `animate-pulse` "Parsing…" text while reading. The Dataset removal button is tucked inside the "Precision Control" block.
**The Problem:** For a 500MB CSV file, parsing may take seconds or longer. "Parsing..." without a progress indicator limits user trust. Taking away the Dropzone removes the immediate mental model of "how do I load a different file?".

### Recommendations
* **Determinate Progress Bar:** If using a Web Worker to parse chunks, feedback the percentage completed (`Uploaded 45%` / `Parsed 250,000 rows...`) instead of an indefinite pulse.
* **Global Drag-and-Drop:** Make the entire window accept file drops even when a dataset is loaded, gracefully prompting "Replace current dataset?".
* **Clearer "Start Over" CTA:** Move the "Remove dataset" or "Upload New" button to the top-right header area, giving it a primary or distinct destructive action placement.

---

## 5. Summary Chips & Number Formatting
### Current State
`Rows (raw)` displays raw numbers like `1450239`.
**The Problem:** Large raw numbers are difficult to read at a glance.

### Recommendations
* **Locale Strings:** Apply `.toLocaleString()` so numbers show up as `1,450,239`.
* **Compact Notation:** For extremely large tables, considering using `Intl.NumberFormat` with `notation: "compact"` (e.g., `1.4M` or `1.45M`) to preserve space in the Stat Chips.
