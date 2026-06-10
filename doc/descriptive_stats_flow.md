# Data Flow: Data Tab to Descriptive Statistics

## 1. Global State Management (`AppState`)
The entire application relies on a centralized state object called `AppState` (defined in `state/app_state.py`). This object is initialized once when the app launches (`ui/layout.py`) and passed to all tabs. It acts as the single source of truth for your data and holds:
- `state.df`: The raw, unmodified dataset.
- `state.filtered_df`: The dataset after applying any filters.
- `state.numeric_cols` & `state.categorical_cols`: The lists of columns categorized by their data type.

## 2. Data Upload & Modification (The Data Tab)
When a user interacts with the **Data Tab** (`ui/tabs/data_tab.py` & `controllers/data_controller.py`):
1. **Upload**: Uploading a CSV/Excel file triggers the `on_file_upload` function. The app reads the file and populates `state.df` and `state.filtered_df`. It also automatically infers which columns are numeric and which are categorical, updating `state.numeric_cols` and `state.categorical_cols`.
2. **Filtering**: If the user applies category filters (max 3 at a time), the `apply_category_filters` function creates a subset of the data and stores it in `state.filtered_df`. `state.df` remains untouched so the user can always revert.
3. **Reclassification**: The "Fix Variable Type" tools let the user manually move columns between `state.numeric_cols` and `state.categorical_cols` if the automatic inference got it wrong.

## 3. Data Consumption (The Estimation Tab > Descriptive Statistics)
When a user moves to the **Descriptive Statistics** sub-tab (`ui/tabs/estimation/descriptive_tab.py`):
1. **Fetching Columns**: Clicking the "Refresh Numeric Columns" button reads `state.numeric_cols` and populates the dropdowns for "Select Numeric Variable" and "Weights Column". This ensures only valid numeric data can be processed.
2. **Running the Stats**: When the user configures their parameters (Quantiles, Trimmed Mean, Winsorized Limits) and clicks "Run Descriptive Statistics":
   - The GUI calls `run_descriptive_statistics` in `controllers/estimation/descriptive_controller.py`.
   - The controller decides which dataset to use: it prioritizes `state.filtered_df` (if active filters exist), otherwise it falls back to `state.df`.
   - It extracts the requested column (handling and stripping any missing `NaN` values silently).
   - If a weights column is specified, it extracts and binds those weights to the data points.
3. **Computation & Display**: The data is passed to the core mathematical functions (`core.estimation.descriptive`). The returned statistics summary table is formatted based on `state.display_precision` and rendered in the output `gr.Dataframe`.
4. **Global Export**: The summary result is also stored back into the global state as `state.export_table` so that clicking the "Download Table as CSV" button exports the exact matrix the user just generated.

### Summary of the Flow:
**File Upload** ➔ `state.df` & `state.filtered_df` & `state.numeric_cols` ➔ **Filters/Typing Config** (modifies `state.filtered_df` / lists) ➔ **Descriptive Stats Tab** reads `state.numeric_cols` for dropdown options ➔ Executes request on `state.filtered_df` (or `state.df`) ➔ Displays results & saves to `state.export_table` for download.

---

## Elements Accessible via GUI

### Data Tab
*   **File Input**: Upload CSV or Excel file (`gr.File`).
*   **Status Indicators**: Status textbox for file upload success/failure (`gr.Textbox`).
*   **Data Previews**: 
    *   Checkboxes to toggle "Show Preview" (raw dataframes) (`gr.Checkbox`).
    *   Checkboxes to toggle "Show Dataset Summary" (descriptive summary and variable types) (`gr.Checkbox`).
*   **Data Filtering**:
    *   Accordion "Filter Data" (`gr.Accordion`).
    *   Dropdown to select up to 3 Categorical Columns (`gr.Dropdown`).
    *   Dynamic dropdowns to select specific categories for the chosen columns (Filter 1, Filter 2, Filter 3) (`gr.Dropdown`).
    *   "Apply Filter" button (`gr.Button`) and a Filter Status textbox (`gr.Textbox`).
    *   Preview and summary checkboxes for the *filtered* dataset (`gr.Checkbox`).
*   **Data Reclassification**:
    *   Accordion "Fix Variable Type" (`gr.Accordion`).
    *   Dropdown to "Reclassify Numeric Column as Categorical" + Action Button (`gr.Dropdown`, `gr.Button`).
    *   Dropdown to "Reclassify Categorical Column as Numeric" + Action Button (`gr.Dropdown`, `gr.Button`).
    *   Status textbox for reclassification actions (`gr.Textbox`).
*   **Outputs**: Viewable Dataframes for CSV Preview, Descriptive Summary, and Variable Types (for both raw and filtered data) (`gr.Dataframe`).

### Estimation Tab > Descriptive Statistics
*   **Variable Selection**:
    *   "Refresh Numeric Columns" button (updates the dropdowns based on the current parsed state) (`gr.Button`).
    *   "Select Numeric Variable" dropdown (choices populated from `state.numeric_cols`) (`gr.Dropdown`).
    *   "Weights Column (optional)" dropdown (`gr.Dropdown`).
*   **Statistical Parameters**:
    *   "Quantiles" text input (default: `0.25, 0.5, 0.75`) (`gr.Textbox`).
    *   "Trimmed Mean α" text input (default: `0.1`) (`gr.Textbox`).
    *   "Winsorized Limits" text input (default: `0.1, 0.1`) (`gr.Textbox`).
*   **Execution**:
    *   "Run Descriptive Statistics" button (`gr.Button`).
*   **Outputs & Export**:
    *   Dataframe displaying the computed descriptive statistics (`gr.Dataframe`).
    *   "Filename" text input (appears after running stats) (`gr.Textbox`).
    *   "Download Table as CSV" button (`gr.Button`).
    *   File payload link for the downloaded CSV (`gr.File`).
