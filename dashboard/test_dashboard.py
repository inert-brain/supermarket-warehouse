"""Offline tests: python -m unittest discover -v (no Firebase credentials)."""
from copy import deepcopy
from datetime import date, datetime, timezone
import unittest
from unittest.mock import Mock

import requests

from firebase_client import Config, FirebaseClient, SyncError, validate_row
from metrics import expiry_label, quality_warnings, slot_cards, stock_metrics
from sync_state import sync_snapshot

STAMP = "2026-01-01T12:00:00Z"


def stock(product="p1", status="OCCUPIED"):
    return dict(productID=product, currentStatus=status, statusUpdatedAt=STAMP,
                description=None, expiresOn=None)


def slot(number=1, product=None):
    return dict(slotId=number, productID=product, assignedAt=STAMP if product else None)


def activity(number=1):
    return dict(activityId=number, productID="p1", occurredAt=STAMP, activityType="ON_RACK")


def response(table, rows):
    result = Mock(status_code=200)
    result.json.return_value = {"data": {table: rows}}
    return result


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.session = Mock()
        self.client = FirebaseClient(Config("test-key", "test-app"), self.session)

    def test_pagination_and_contract(self):
        rows = [stock(f"p{i:03d}") for i in range(100)]
        self.session.post.side_effect = [response("stocks", rows), response("stocks", [stock("p100")])]
        self.assertEqual(len(self.client.read_table("stocks")), 101)
        calls = self.session.post.call_args_list
        self.assertEqual(calls[0].kwargs["json"], {"operationName": "DashboardStocks", "variables": {"after": None, "limit": 100}})
        self.assertEqual(calls[1].kwargs["json"]["variables"], {"after": "p099", "limit": 100})
        self.assertTrue(calls[0].args[0].endswith(":executeQuery"))
        self.assertEqual(calls[0].kwargs["timeout"], (5, 30))
        self.assertFalse(calls[0].kwargs["allow_redirects"])
        self.assertEqual(calls[0].kwargs["headers"]["x-firebase-gmpid"], "test-app")

    def test_int_cursors_and_exact_page_boundary(self):
        for table, maker, operation in [("slots", slot, "DashboardSlots"), ("activities", activity, "DashboardActivities")]:
            with self.subTest(table=table):
                self.session.reset_mock()
                self.session.post.side_effect = [response(table, [maker(i) for i in range(100)]), response(table, [])]
                self.assertEqual(len(self.client.read_table(table)), 100)
                body = self.session.post.call_args.kwargs["json"]
                self.assertEqual(body, {"operationName": operation, "variables": {"after": 99, "limit": 100}})

    def test_deduplicates_identical_rows(self):
        self.session.post.return_value = response("stocks", [stock(), stock()])
        self.assertEqual(self.client.read_table("stocks"), [stock()])

    def test_conflicting_duplicate_rejected(self):
        self.session.post.return_value = response("stocks", [stock(), stock(status="EMPTY")])
        with self.assertRaises(SyncError):
            self.client.read_table("stocks")

    def test_empty_snapshot(self):
        self.session.post.side_effect = [response(table, []) for table in ("stocks", "slots", "activities")]
        snapshot = self.client.fetch_snapshot()
        self.assertEqual([snapshot[key] for key in ("stocks", "slots", "activities")], [[], [], []])
        self.assertLessEqual(snapshot["started_at"], snapshot["completed_at"])

    def test_malformed_pages(self):
        payloads = [None, {}, {"errors": [{"message": "denied"}]}, {"data": {"stocks": None}},
                    {"data": {"stocks": [{}]}}, {"data": {"stocks": [stock(status="UNKNOWN")]}},
                    {"data": {"stocks": [stock("b"), stock("a")]}},
                    {"data": {"stocks": [stock()] * 101}}]
        for payload in payloads:
            with self.subTest(payload=payload):
                self.session.post.return_value = Mock(status_code=200)
                self.session.post.return_value.json.return_value = payload
                with self.assertRaises(SyncError):
                    self.client.read_table("stocks")

    def test_cursor_stall(self):
        client = FirebaseClient(Config("key", "app"), self.session, page_size=1)
        self.session.post.side_effect = [response("stocks", [stock()]), response("stocks", [stock()])]
        with self.assertRaises(SyncError):
            client.read_table("stocks")

    def test_http_json_and_network_errors_are_sanitized(self):
        for status in (400, 401, 403, 404, 500):
            self.session.post.return_value = Mock(status_code=status)
            with self.assertRaises(SyncError):
                self.client.read_table("stocks")
        self.session.post.return_value = Mock(status_code=200)
        self.session.post.return_value.json.side_effect = ValueError("bad JSON")
        with self.assertRaises(SyncError):
            self.client.read_table("stocks")
        self.session.post.side_effect = requests.Timeout("secret-test-key")
        with self.assertRaises(SyncError) as raised:
            self.client.read_table("stocks")
        self.assertNotIn("secret-test-key", str(raised.exception))

    def test_field_validation(self):
        invalid = [dict(stock(), statusUpdatedAt="yesterday"), dict(stock(), expiresOn="bad"),
                   dict(stock(), description=42), dict(slot(), slotId=True),
                   dict(activity(), activityType="UNKNOWN"), dict(activity(), occurredAt="2026-01-01")]
        for table, row in zip(("stocks", "stocks", "stocks", "slots", "activities", "activities"), invalid):
            with self.assertRaises(SyncError):
                validate_row(table, row)


class MetricTests(unittest.TestCase):
    def test_status_not_records_or_events(self):
        stocks = [stock("a"), stock("b"), stock("c", "PENDING_DISPATCH")] + [stock(str(i), "EMPTY") for i in range(4)]
        result = stock_metrics(stocks, [slot(1, "c"), slot(2)])
        self.assertEqual((result["warehouse"], result["on_rack"], result["pending_dispatch"], result["empty"]), (3, 2, 1, 4))
        self.assertEqual(result["unassigned_slots"], 1)
        self.assertEqual(slot_cards(stocks, [slot(1, "c")])[0]["status"], "PENDING_DISPATCH")

    def test_empty(self):
        result = stock_metrics([], [])
        self.assertEqual(result["warehouse"], 0)
        self.assertEqual(result["unassigned_slots"], 0)
        self.assertEqual(len(quality_warnings([], [])), 8)
        self.assertTrue(all(card["status"] == "Unknown" for card in slot_cards([], [])))

    def test_quality_and_unknown_cards(self):
        stocks = [stock("a"), stock("b", "EMPTY"), stock("c", "PENDING_DISPATCH")]
        slots = [slot(1, "a"), slot(2, "a"), slot(3, "b"), slot(4, "missing"),
                 dict(slot(5), assignedAt=STAMP), slot(9)]
        before = deepcopy((stocks, slots))
        warnings = "\n".join(quality_warnings(stocks, slots))
        for text in ("missing", "outside", "bound to 2", "EMPTY", "has no slot", "unassigned but"):
            self.assertIn(text, warnings)
        self.assertTrue(all(not card["available"] for card in slot_cards(stocks, slots)))
        self.assertEqual((stocks, slots), before)

    def test_expiry_today_is_valid(self):
        today = date(2026, 1, 1)
        self.assertEqual(expiry_label(None, today), "Missing expiry")
        self.assertEqual(expiry_label("2025-12-31", today), "Expired")
        self.assertNotEqual(expiry_label("2026-01-01", today), "Expired")


class SnapshotTests(unittest.TestCase):
    def test_real_client_partial_fetch_never_publishes(self):
        previous = {"stocks": [stock("old")], "slots": [], "activities": [],
                    "completed_at": datetime.now(timezone.utc)}
        state = {"snapshot": previous}
        session = Mock()
        session.post.side_effect = [response("stocks", [stock("new")]),
                                    response("slots", [slot(1, "new")]),
                                    Mock(status_code=403)]
        client = FirebaseClient(Config("key", "app"), session)
        self.assertFalse(sync_snapshot(state, lambda: client))
        self.assertIs(state["snapshot"], previous)
        self.assertEqual(session.post.call_count, 3)
        session.close.assert_called_once()
        self.assertIn("DashboardActivities", state["sync_error"])

    def test_atomic_failure_then_success(self):
        old = {"stocks": [stock()], "completed_at": datetime.now(timezone.utc)}
        state = {"snapshot": old}
        client = Mock()
        client.fetch_snapshot.side_effect = SyncError("second table failed")
        self.assertFalse(sync_snapshot(state, lambda: client))
        self.assertIs(state["snapshot"], old)
        self.assertEqual(state["snapshot"]["completed_at"], old["completed_at"])
        client.close.assert_called_once()
        self.assertFalse(state["sync_running"])
        new = {"stocks": [], "slots": [], "activities": [], "completed_at": datetime.now(timezone.utc)}
        client.fetch_snapshot.side_effect = None
        client.fetch_snapshot.return_value = new
        self.assertTrue(sync_snapshot(state, lambda: client))
        self.assertIs(state["snapshot"], new)
        self.assertIsNone(state["sync_error"])

    def test_config_failure_and_busy_guard(self):
        state = {}
        factory = Mock(side_effect=ValueError("missing config"))
        self.assertFalse(sync_snapshot(state, factory))
        self.assertNotIn("snapshot", state)
        state["sync_running"] = True
        self.assertFalse(sync_snapshot(state, factory))
        self.assertEqual(factory.call_count, 1)


if __name__ == "__main__":
    unittest.main()
