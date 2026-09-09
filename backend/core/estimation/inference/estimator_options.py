from __future__ import annotations

import numpy as np


ALL_MEAN_ESTIMATORS = [
    "Sample Mean",
    "Geometric Mean",
    "Harmonic Mean",
    "Interquartile Mean",
    "Trimmed Mean",
    "Winsorized Mean",
    "Weighted Mean",
]

ALL_DEVIATION_ESTIMATORS = [
    "Deviation (1 ddof)",
    "IQR (bias corrected)",
    "MAD (bias corrected)",
    "AAD (bias corrected)",
]

ALL_MEDIAN_ESTIMATORS = [
    "Sample Median",
]


def available_estimators(data):
    arr = np.asarray(data, dtype=float)
    arr = arr[~np.isnan(arr)]

    mean_choices = ALL_MEAN_ESTIMATORS.copy()
    if (arr <= 0).any():
        mean_choices = [
            m for m in mean_choices if m not in ("Geometric Mean", "Harmonic Mean")
        ]

    deviation_choices = ALL_DEVIATION_ESTIMATORS.copy()
    if len(arr) > 25:
        deviation_choices = [
            d for d in deviation_choices if d != "Range (bias corrected)"
        ]

    return mean_choices, deviation_choices
