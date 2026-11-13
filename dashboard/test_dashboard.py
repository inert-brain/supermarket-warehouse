"""Offline tests: python -m unittest discover -v (no Firebase credentials)."""
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import unittest
from unittest.mock import Mock

import requests

from firebase_client import Config, FirebaseClient, SyncError, validate_row
from metrics import expiry_label, quality_warnings, slot_cards, stock_metrics
from sync_state import sync_snapshot

STAMP = "2026-01-01T12:00:00Z"
REFERENCE = datetime.fromisoformat(STAMP)


def stock(product="p1", status="OCCUPIED"):
    return dict(containerID=product, currentStatus=status, statusUpdatedAt=STAMP,
                description=None, expiresOn=None)


def slot(number=1, product=None, occupied: bool | None = False, observed: str | None = STAMP):
    return dict(slotId=number, containerID=product, assignedAt=STAMP if product else None,
                isOccupied=occupied, occupancyUpdatedAt=observed)


def activity(number=1):
    return dict(activityId=number, containerID="p1", occurredAt=STAMP, activityType="ON_RACK")


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

    def test_nullable_occupancy_contract(self):
        for occupied in (None, False, True):
            for observed in (None, STAMP, "2026-01-01T19:00:00+07:00"):
                validate_row("slots", slot(occupied=occupied, observed=observed))
        for field in ("isOccupied", "occupancyUpdatedAt"):
            row = slot()
            del row[field]
            self.session.post.return_value = response("slots", [row])
            with self.subTest(missing=field), self.assertRaises(SyncError):
                self.client.read_table("slots")
        for occupied in (0, 1, "false", [], {}):
            with self.subTest(occupied=occupied), self.assertRaises(SyncError):
                validate_row("slots", dict(slot(), isOccupied=occupied))
        for observed in (True, 42, "yesterday", "2026-01-01T12:00:00"):
            with self.subTest(observed=observed), self.assertRaises(SyncError):
                validate_row("slots", dict(slot(), occupancyUpdatedAt=observed))


class MetricTests(unittest.TestCase):
    def test_status_not_records_or_events(self):
        stocks = [stock("a"), stock("b"), stock("c", "PENDING_DISPATCH")] + [stock(str(i), "EMPTY") for i in range(4)]
        for observed in (STAMP, None, "2025-01-01T00:00:00Z"):
            slots = [slot(1, "c", observed=observed), slot(2)]
            result = stock_metrics(stocks, slots, REFERENCE)
            self.assertEqual((result["warehouse"], result["on_rack"], result["pending_dispatch"], result["empty"]), (3, 2, 1, 4))
            self.assertEqual(result["available_slots"], 1)
        self.assertEqual(slot_cards(stocks, [slot(1, "c")], REFERENCE)[0]["status"], "Off-rack / reserved")

    def test_slot_state_matrix(self):
        stocks = [stock("a", "EMPTY"), stock("b"), stock("c", "PENDING_DISPATCH")]
        slots = [slot(1), slot(2, "a"), slot(3, "b", True), slot(4, "c"),
                 slot(5, occupied=True), slot(6, occupied=None), slot(7, observed=None),
                 slot(8, observed="2026-01-01T11:59:29Z")]
        before = deepcopy((stocks, slots))
        cards = slot_cards(stocks, slots, REFERENCE)
        self.assertEqual([card["status"] for card in cards[:5]],
                         ["Available (demo)", "Awaiting placement", "Occupied", "Off-rack / reserved", "Occupied / unidentified"])
        self.assertEqual([card["available"] for card in cards], [True, False, False, False, False, True, True, True])
        self.assertEqual([card["containerID"] for card in cards[1:4]], ["a", "b", "c"])
        self.assertEqual(cards[7]["observation_status"], "31s old at sync")
        self.assertEqual(cards[7]["occupancyUpdatedAt"], slots[7]["occupancyUpdatedAt"])
        self.assertFalse(quality_warnings(stocks, slots, REFERENCE))
        self.assertEqual(stock_metrics(stocks, slots, REFERENCE)["warehouse"], 2)
        self.assertEqual((stocks, slots), before)

    def test_demo_availability_ignores_observation_age_and_unknown(self):
        observations = [None, "2026-01-01T18:59:20+07:00"] + [
            (REFERENCE - timedelta(seconds=age)).isoformat()
            for age in (0, 30, 30.001, 86400, -1)
        ]
        for observed in observations:
            for occupied in (False, None, True):
                for product in (None, "a"):
                    with self.subTest(observed=observed, occupied=occupied, product=product):
                        slots = [slot(1, product, occupied, observed)]
                        before = deepcopy(slots)
                        available = product is None and occupied is not True
                        card = slot_cards([stock("a")], slots, REFERENCE)[0]
                        self.assertEqual(card["available"], available)
                        self.assertEqual(stock_metrics([stock("a")], slots, REFERENCE)["available_slots"], int(available))
                        self.assertEqual(card["isOccupied"], occupied)
                        self.assertEqual(card["occupancyUpdatedAt"], observed)
                        if product is not None and occupied is None:
                            self.assertEqual(card["status"], "Occupancy unknown / reserved")
                        self.assertEqual(slots, before)

    def test_observation_age_and_unknown_time_display(self):
        for observed, label in ((None, "Unknown observation time"),
                                ("2026-01-01T18:59:20+07:00", "40s old at sync"),
                                ("2026-01-01T12:00:01Z", "Future timestamp / age unknown")):
            for occupied in (None, False, True):
                with self.subTest(observed=observed, occupied=occupied):
                    card = slot_cards([], [slot(occupied=occupied, observed=observed)], REFERENCE)[0]
                    self.assertEqual(card["observation_status"], label)

    def test_old_or_undated_conflicts_still_warn_without_age_gating(self):
        for observed in (None, "2025-01-01T00:00:00Z"):
            slots = [slot(1, "a", True, observed)] + [slot(i) for i in range(2, 9)]
            warnings = quality_warnings([stock("a", "EMPTY")], slots, REFERENCE)
            self.assertEqual(len(warnings), 1)
            self.assertIn("conflicts", warnings[0])

    def test_inconsistent_observations_warn_without_recounting(self):
        stocks = [stock("a", "EMPTY"), stock("b"), stock("c", "PENDING_DISPATCH")]
        slots = [slot(1, "a", True), slot(2, "b"), slot(3, "c", True)] + [slot(i) for i in range(4, 9)]
        self.assertTrue(all(card["status"] == "Inconsistent / Sync again"
                            for card in slot_cards(stocks, slots, REFERENCE)[:3]))
        warnings = quality_warnings(stocks, slots, REFERENCE)
        self.assertEqual(len(warnings), 3)
        self.assertTrue(all("conflicts" in warning for warning in warnings))
        self.assertEqual(stock_metrics(stocks, slots, REFERENCE)["warehouse"], 2)

    def test_empty(self):
        result = stock_metrics([], [], REFERENCE)
        self.assertEqual(result["warehouse"], 0)
        self.assertEqual(result["available_slots"], 0)
        self.assertEqual(len(quality_warnings([], [], REFERENCE)), 8)
        self.assertTrue(all(card["status"].startswith("Unknown") for card in slot_cards([], [], REFERENCE)))

    def test_quality_and_unknown_cards(self):
        stocks = [stock("a"), stock("b", "EMPTY"), stock("c", "PENDING_DISPATCH")]
        slots = [slot(1, "a", True), slot(2, "a", True), slot(3, "b", True), slot(4, "missing"),
                 dict(slot(5), assignedAt=STAMP), slot(9)]
        before = deepcopy((stocks, slots))
        warnings = "\n".join(quality_warnings(stocks, slots, REFERENCE))
        for text in ("missing", "outside", "bound to 2", "EMPTY", "has no slot", "unassigned but"):
            self.assertIn(text, warnings)
        cards = slot_cards(stocks, slots, REFERENCE)
        self.assertEqual([card["slotId"] for card in cards if card["available"]], [5])
        self.assertEqual(stock_metrics(stocks, slots, REFERENCE)["available_slots"], 1)
        self.assertEqual((stocks, slots), before)

    def test_duplicate_slots_and_missing_assignment_time_unavailable(self):
        slots = [slot(), slot(), dict(slot(2, "a", True), assignedAt=None)]
        self.assertTrue(all(not card["available"] for card in slot_cards([stock("a")], slots, REFERENCE)))
        warnings = "\n".join(quality_warnings([stock("a")], slots, REFERENCE))
        self.assertIn("duplicate records", warnings)
        self.assertIn("has no assignedAt", warnings)

    def test_expiry_today_is_valid(self):
        today = date(2026, 1, 1)
        self.assertEqual(expiry_label(None, today), "Missing expiry")
        self.assertEqual(expiry_label("2025-12-31", today), "Expired")
        self.assertNotEqual(expiry_label("2026-01-01", today), "Expired")


class SnapshotTests(unittest.TestCase):
    def test_old_connector_contract_retains_snapshot(self):
        previous = {"completed_at": REFERENCE}
        state = {"snapshot": previous}
        session = Mock()
        legacy_slot = {key: slot()[key] for key in ("slotId", "containerID", "assignedAt")}
        session.post.side_effect = [response("stocks", []), response("slots", [legacy_slot])]
        self.assertFalse(sync_snapshot(state, lambda: FirebaseClient(Config("key", "app"), session)))
        self.assertIs(state["snapshot"], previous)
        self.assertIn("missing required fields", state["sync_error"])
        self.assertEqual(session.post.call_count, 2)
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
