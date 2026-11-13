"""Read-only shelf snapshots from Firestore products/SHELF_* documents."""
from datetime import datetime, timezone
import requests


class ShelfReadError(Exception):
    pass


def decode(value):
    for key in ("stringValue", "timestampValue", "referenceValue", "booleanValue", "doubleValue"):
        if key in value:
            return value[key]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "nullValue" in value:
        return None
    if "mapValue" in value:
        return {key: decode(item) for key, item in value["mapValue"].get("fields", {}).items()}
    if "arrayValue" in value:
        return [decode(item) for item in value["arrayValue"].get("values", [])]
    raise ValueError("Unsupported Firestore value")


def fetch_shelves(project="mart-parking-fdd6b", session=None):
    # Current project permits these reads through Firestore rules. No admin credentials.
    if not isinstance(project, str) or not project or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in project):
        raise ShelfReadError("Invalid Firestore project.")
    base = f"projects/{project}/databases/(default)/documents"
    endpoint = f"https://firestore.googleapis.com/v1/{base}:runQuery"
    shelves = []
    after = None
    owned = session is None
    session = session or requests.Session()
    try:
        for _ in range(1000):
            filters = [
                {"fieldFilter": {"field": {"fieldPath": "__name__"}, "op": "GREATER_THAN_OR_EQUAL", "value": {"referenceValue": base + "/products/SHELF_"}}},
                {"fieldFilter": {"field": {"fieldPath": "__name__"}, "op": "LESS_THAN", "value": {"referenceValue": base + "/products/SHELF`"}}},
            ]
            if after:
                filters.append({"fieldFilter": {"field": {"fieldPath": "__name__"}, "op": "GREATER_THAN", "value": {"referenceValue": after}}})
            query = {"from": [{"collectionId": "products"}],
                     "where": {"compositeFilter": {"op": "AND", "filters": filters}},
                     "orderBy": [{"field": {"fieldPath": "__name__"}, "direction": "ASCENDING"}], "limit": 100}
            response = session.post(endpoint, json={"structuredQuery": query}, timeout=(5, 20))
            if response.status_code != 200:
                raise ShelfReadError(f"Shelf read failed (HTTP {response.status_code}). Check project access and Firestore rules.")
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError("Invalid query response")
            documents = [entry["document"] for entry in payload if "document" in entry]
            for document in documents:
                name = document["name"]
                if not name.startswith(base + "/products/SHELF_") or (after and name <= after):
                    raise ValueError("Invalid shelf ordering")
                fields = {key: decode(value) for key, value in document.get("fields", {}).items()}
                shelves.append({"id": name.rsplit("/", 1)[1], "fields": fields})
                after = name
            if len(documents) < 100:
                return {"shelves": shelves, "completed_at": datetime.now(timezone.utc)}
        raise ShelfReadError("Shelf read exceeded the page limit; previous snapshot retained.")
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        raise ShelfReadError("Could not read a complete shelf snapshot. Check Firestore access and try again.") from exc
    finally:
        if owned:
            session.close()
