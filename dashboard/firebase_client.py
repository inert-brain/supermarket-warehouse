"""Read-only, predefined-operation Data Connect client. No arbitrary GraphQL."""
from dataclasses import dataclass
from datetime import date, datetime, timezone
import re

import requests

STATUSES = ("OCCUPIED", "PENDING_DISPATCH", "EMPTY")
ACTIVITY_TYPES = ("ON_RACK", "OFF_RACK", "DISPATCHED", "REMOVED")
FIELDS = {
    "stocks": ("productID", "currentStatus", "statusUpdatedAt", "description", "expiresOn"),
    "slots": ("slotId", "productID", "assignedAt"),
    "activities": ("activityId", "productID", "occurredAt", "activityType"),
}
OPERATIONS = {
    "stocks": ("DashboardStocks", "productID", str),
    "slots": ("DashboardSlots", "slotId", int),
    "activities": ("DashboardActivities", "activityId", int),
}


class SyncError(Exception):
    """An incomplete or invalid read; never treat as an empty snapshot."""


@dataclass(frozen=True)
class Config:
    api_key: str
    app_id: str
    project: str = "smart-warehouse-3171e"
    region: str = "asia-southeast1"
    service: str = "smart-warehouse-service"
    connector: str = "example"

    def __post_init__(self):
        if not self.api_key or not self.app_id:
            raise ValueError("Set api_key and app_id in Streamlit secrets or FIREBASE_API_KEY / FIREBASE_APP_ID.")
        for value in (self.project, self.region, self.service, self.connector):
            if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
                raise ValueError("Invalid Data Connect resource identifier.")


def _timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Expected timestamp string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Expected timezone-aware timestamp")


def validate_row(table, row):
    if not isinstance(row, dict) or any(field not in row for field in FIELDS[table]):
        raise SyncError(f"{table}: row missing required fields")
    _, key, key_type = OPERATIONS[table]
    if type(row[key]) is not key_type or (key_type is str and not row[key]):
        raise SyncError(f"{table}: invalid primary key")
    try:
        if table == "stocks":
            if row["currentStatus"] not in STATUSES:
                raise ValueError("Unknown stock status")
            _timestamp(row["statusUpdatedAt"])
            if row["description"] is not None and not isinstance(row["description"], str):
                raise ValueError("Invalid description")
            if row["expiresOn"] is not None:
                if not isinstance(row["expiresOn"], str):
                    raise ValueError("Invalid expiry")
                date.fromisoformat(row["expiresOn"])
        elif table == "slots":
            if row["productID"] is not None and (not isinstance(row["productID"], str) or not row["productID"]):
                raise ValueError("Invalid product ID")
            if row["assignedAt"] is not None:
                _timestamp(row["assignedAt"])
        else:
            if not isinstance(row["productID"], str) or not row["productID"]:
                raise ValueError("Invalid product ID")
            if row["activityType"] not in ACTIVITY_TYPES:
                raise ValueError("Unknown activity type")
            _timestamp(row["occurredAt"])
    except (ValueError, TypeError) as exc:
        raise SyncError(f"{table}: invalid field value") from exc


class FirebaseClient:
    def __init__(self, config, session=None, page_size=100):
        if type(page_size) is not int or not 1 <= page_size <= 1000:
            raise ValueError("page_size must be between 1 and 1000")
        self.config = config
        self.session = session if session is not None else requests.Session()
        self.page_size = page_size
        self.url = (
            "https://firebasedataconnect.googleapis.com/v1/projects/"
            f"{config.project}/locations/{config.region}/services/{config.service}"
            f"/connectors/{config.connector}:executeQuery"
        )

    def read_table(self, table):
        operation, key, _ = OPERATIONS[table]
        after = None
        rows = {}
        while True:
            try:
                response = self.session.post(
                    self.url, params={"key": self.config.api_key},
                    headers={"Content-Type": "application/json", "x-firebase-gmpid": self.config.app_id},
                    json={"operationName": operation, "variables": {"after": after, "limit": self.page_size}},
                    timeout=(5, 30), allow_redirects=False,
                )
                if response.status_code != 200:
                    raise SyncError(f"{operation}: HTTP {response.status_code}. Check configuration, access and deployed query.")
                payload = response.json()
            except (requests.RequestException, ValueError) as exc:
                # Do not display raw request errors: their URL can contain the API key.
                raise SyncError(f"{operation}: network failure or invalid JSON; snapshot unchanged.") from exc
            if not isinstance(payload, dict) or payload.get("errors"):
                raise SyncError(f"{operation}: invalid response or GraphQL errors; check deployed query contract.")
            data = payload.get("data")
            page = data.get(table) if isinstance(data, dict) else None
            if not isinstance(page, list) or len(page) > self.page_size:
                raise SyncError(f"{operation}: missing or malformed {table} page")
            previous = None
            for row in page:
                validate_row(table, row)
                value = row[key]
                if (after is not None and value <= after) or (previous is not None and value < previous):
                    raise SyncError(f"{operation}: cursor did not advance in ascending key order")
                if value in rows and rows[value] != row:
                    raise SyncError(f"{operation}: conflicting duplicate primary key")
                rows[value] = dict(row)
                previous = value
            if len(page) < self.page_size:
                return list(rows.values())
            after = page[-1][key]

    def fetch_snapshot(self):
        started = datetime.now(timezone.utc)
        # Never publish individual tables: the caller receives only a complete read.
        tables = {table: self.read_table(table) for table in OPERATIONS}
        return {**tables, "started_at": started, "completed_at": datetime.now(timezone.utc)}

    def close(self):
        self.session.close()
