import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from main import app
from sessions.store import set_session

client = TestClient(app)

ONE_SAMPLE = "One sample Student's t-test"
TWO_SAMPLE = "Two samples Student's t-test"
VARIANCE = "Equal variance between two groups"
ANOVA = "One-way ANOVA"


@pytest.fixture
def mock_session():
    session_id = "hypothesis-session-123"
    rng = np.random.default_rng(7)
    df = pd.DataFrame(
        {
            "score": np.concatenate(
                [rng.normal(72, 8, 40), rng.normal(78, 12, 35), rng.normal(70, 9, 30)]
            ),
            "region": ["North"] * 20 + ["East"] * 20 + ["South"] * 35 + ["West"] * 30,
        }
    )
    set_session(session_id, df)
    return session_id


def _post(session_id, **body):
    payload = dict(session_id=session_id, column="score")
    payload.update(body)
    return client.post(
        "/api/hypothesis/test", json=payload, headers={"x-session-id": session_id}
    )


def _group(values, name):
    return {"column": "region", "values": values, "name": name}


TWO_GROUPS = dict(
    group1=_group(["North", "East"], "N+E"),
    group2=_group(["South"], "South"),
)


def test_one_sample_test_api(mock_session):
    response = _post(mock_session, test_type=ONE_SAMPLE, mu0=72.0, alpha=0.05)
    assert response.status_code == 200

    body = response.json()
    assert body["test_type"] == ONE_SAMPLE
    assert body["verdict"] in ("Reject H₀", "Fail to reject H₀")
    assert body["rejection_region"]["dist"] == "t"
    assert 0.0 <= body["p_value"] <= 1.0


@pytest.mark.parametrize(
    "body",
    [
        dict(test_type=ONE_SAMPLE, mu0=72.0),
        dict(test_type=TWO_SAMPLE, **TWO_GROUPS),
        dict(test_type=VARIANCE, variance_test_type="Levene", **TWO_GROUPS),
        dict(test_type=VARIANCE, variance_test_type="Bartlett", **TWO_GROUPS),
        dict(test_type=ANOVA, anova_column="region", anova_levels=["North", "East", "South"]),
    ],
)
def test_every_test_type_returns_a_complete_payload(mock_session, body):
    response = _post(mock_session, **body)
    assert response.status_code == 200

    payload = response.json()
    region = payload["rejection_region"]
    assert len(region["x"]) == len(region["pdf"])
    assert region["y_max"] > 0
    assert region["critical_values"]
    assert region["reject_region"] and region["p_area"]
    assert payload["group_summary"]
    assert payload["h0"] and payload["h1"]


def test_alpha_moves_the_verdict_not_the_statistic(mock_session):
    lenient = _post(mock_session, test_type=TWO_SAMPLE, alpha=0.05, **TWO_GROUPS).json()
    strict = _post(mock_session, test_type=TWO_SAMPLE, alpha=1e-8, **TWO_GROUPS).json()

    assert lenient["statistic"] == pytest.approx(strict["statistic"])
    assert lenient["p_value"] == pytest.approx(strict["p_value"])
    assert lenient["reject"] is True
    assert strict["reject"] is False


def test_missing_column_is_a_client_error(mock_session):
    response = _post(mock_session, test_type=ONE_SAMPLE, mu0=1.0, column="nope")
    assert response.status_code == 400


def test_missing_mu0_is_a_client_error(mock_session):
    response = _post(mock_session, test_type=ONE_SAMPLE)
    assert response.status_code == 400
    assert "μ₀" in response.json()["detail"]


def test_unknown_test_type_is_a_client_error(mock_session):
    response = _post(mock_session, test_type="Mann-Whitney U")
    assert response.status_code == 400
    assert "Unknown hypothesis test" in response.json()["detail"]


def test_alpha_outside_the_unit_interval_is_a_client_error(mock_session):
    response = _post(mock_session, test_type=ONE_SAMPLE, mu0=72.0, alpha=1.5)
    assert response.status_code == 400


def test_filters_narrow_the_groups(mock_session):
    unfiltered = _post(mock_session, test_type=ONE_SAMPLE, mu0=72.0).json()
    filtered = _post(
        mock_session, test_type=ONE_SAMPLE, mu0=72.0, filters={"region": ["North"]}
    ).json()

    assert filtered["group_summary"][0]["n"] == 20
    assert filtered["group_summary"][0]["n"] < unfiltered["group_summary"][0]["n"]


def test_no_session_is_not_found():
    response = client.post(
        "/api/hypothesis/test",
        json=dict(session_id="ghost", column="score", test_type=ONE_SAMPLE, mu0=1.0),
        headers={"x-session-id": "ghost"},
    )
    assert response.status_code == 404
