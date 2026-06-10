# Data Tab Large Dataset Redesign (Mockup)

This is a text-based wireframe representing the proposed layout and interactivity for the `DataTab` handling large datasets.

```text
================================================================================
 Dataset                                      [ Display precision: [3 dec ⌄] ]
 Upload a CSV file to use across all          [ 🗑 Remove dataset            ]
 analysis tabs. · sales_data_2026.csv
================================================================================
                               SUMMARY CARDS
+---------------+  +---------------+  +---------------+  +---------------+
| ROWS (RAW)    |  | ROWS (FILT)   |  | NUMERIC COLS  |  | CATEGORICAL C |
| 1,450,239     |  | 1,450,239     |  | 105           |  | 42            |
+---------------+  +---------------+  +---------------+  +---------------+

================================================================================
                              CONTROLS SECTION
+------------------------------------+  +------------------------------------+
| COLUMN TYPES                       |  | CATEGORY FILTERS                   |
| ---------------------------------- |  | ---------------------------------- |
| [ 🔍 Search columns...           ] |  | [ + Add Filter ]   [ Clear all ]   |
|                                    |  |                                    |
| transaction_id       [Categorical] |  | +-- region ----------------------+ |
| amount               [Numeric    ] |  | | NA (42k) x  EU (12k) x         | |
| state                [Categorical] |  | | [🔍 Search 'region' values...] | |
| location_lat         [Numeric    ] |  | +--------------------------------+ |
| ... + 143 more.                    |  |                                    |
|                                    |  | +-- payment_method ---------------+|
|                                    |  | | [🔍 Search 'payment_method'...]||
|                                    |  | +--------------------------------+ |
+------------------------------------+  +------------------------------------+
    └─ Scrollable container (Max H)         └─ Scrollable container (Max H)
       Quick search filters list               Searchable combobox per filter

================================================================================
                                DATA PREVIEW
 DATA PREVIEW      Showing 1 to 50 of 1,450,239 filtered rows (1,450,239 total)
+------------------------------------------------------------------------------+
| #   | transaction_id | amount  | state | ...(+ 143 columns)...               |
|-----|----------------|---------|-------|-------------------------------------|
| 1   | 100421         | 420.50  | TX    | ...                                 |
| 2   | 100422         | 15.00   | CA    | ...                                 |
| 3   | 100423         | 1,320.9 | NY    | ...                                 |
| ... | ...            | ...     | ...   | ...                                 |
| 50  | 100470         | 45.00   | FL    | ...                                 |
+------------------------------------------------------------------------------+
 [ |< First ]  [ < Prev ]   Page 1 of 29,005   [ Next > ]  [ Last >| ]
```

## Key Interactive Flows Illustrated:

1. **The Numbers:** Notice the formatting (`1,450,239`). It makes the summary cards parseable in less than a second.
2. **Column Types Search:** If a user needs to fix the classification of `location_lat` in a 150-column dataset, they type "loc" into the search bar. The scrollable list instantly filters down, allowing them to flip the toggle.
3. **High-Cardinality Add Filter:** The UI no longer automatically renders all unique values for every column. The user actively adds a filter block for `region`. If they need to filter by `state` (50 unique values), they use the searchable combobox field rather than facing a 50-item button wall.
4. **Pagination:** The user can now click `Next` or jump to page 50 using proper table pagination controls to explore deep into the dataset.

This structure retains the neat, clean aesthetic of your original implementation but applies enterprise UI patterns to manage scale gracefully.
