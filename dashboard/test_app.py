"""Headless Streamlit integration tests; no server or Firebase access required."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import unittest
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

from firebase_client import SyncError
from test_dashboard import activity, slot, stock

APP = str(Path(__file__).with_name("app.py"))


def snapshot(empty=False):
    now = datetime.now(timezone.utc)
    return {"stocks": [] if empty else [stock()],
            "slots": [] if empty else [slot(1, "p1", True, now.isoformat()), slot(2, observed=now.isoformat())],
            "activities": [] if empty else [activity(), dict(activity(2), activityType="REMOVED")],
            "started_at": now, "completed_at": now}


class AppTests(unittest.TestCase):
    def setUp(self):
        secrets = patch("streamlit.secrets", {})
        secrets.start()
        self.addCleanup(secrets.stop)
        self.env = patch.dict(os.environ, {"FIREBASE_API_KEY": "test-key", "FIREBASE_APP_ID": "test-app"})
        self.env.start()
        self.addCleanup(self.env.stop)
        network = patch("requests.Session.post", side_effect=AssertionError("Unexpected Firebase read"))
        network.start()
        self.addCleanup(network.stop)

    def test_initial_reruns_do_not_read(self):
        with patch("requests.Session.post", side_effect=AssertionError("Unexpected Firebase read")) as post:
            app = AppTest.from_file(APP).run()
            self.assertFalse(app.exception)
            self.assertIn("No data loaded. Click Sync.", [info.value for info in app.info])
            app.run()
            self.assertFalse(app.exception)
            post.assert_not_called()

    def test_missing_configuration_is_a_visible_failure(self):
        with patch.dict(os.environ, {"FIREBASE_API_KEY": "", "FIREBASE_APP_ID": ""}):
            app = AppTest.from_file(APP).run()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertTrue(app.error)
            self.assertNotIn("snapshot", app.session_state)

    def test_sync_filters_and_failure_retain_snapshot(self):
        complete = snapshot()
        with patch("firebase_client.FirebaseClient.fetch_snapshot", return_value=complete) as fetch:
            app = AppTest.from_file(APP).run()
            fetch.assert_not_called()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(app.session_state["snapshot"], complete)
            self.assertEqual(app.metric[0].value, "1")
            app.number_input[0].set_value(5).run()
            app.text_input[0].set_value("p1").run()
            app.multiselect[0].set_value(["EMPTY"]).run()
            app.multiselect[1].set_value(["REMOVED"]).run()
            app.date_input[0].set_value(("2026-01-01", "2026-01-02")).run()
            self.assertFalse(app.exception)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(app.metric[0].value, "1")
            fetch.side_effect = SyncError("activity query failed")
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertEqual(app.session_state["snapshot"], complete)
            self.assertIn("activity query failed", app.error[0].value)
            self.assertEqual(fetch.call_count, 2)

    def test_demo_availability_and_occupancy_display_without_automatic_reads(self):
        complete = snapshot()
        completed = complete["completed_at"]
        observed = (completed - timedelta(seconds=40)).isoformat()
        complete["stocks"] += [stock("awaiting", "EMPTY"), stock("pending", "PENDING_DISPATCH")]
        complete["slots"] += [slot(3, "awaiting", observed=completed.isoformat()),
                              slot(4, "pending", observed=completed.isoformat()),
                              slot(5, occupied=True, observed=completed.isoformat()),
                              slot(6, observed=observed), slot(7, occupied=None, observed=None),
                              slot(8, "unknown-reserved", occupied=None, observed=None)]
        complete["stocks"].append(stock("unknown-reserved", "EMPTY"))
        with patch("firebase_client.FirebaseClient.fetch_snapshot", return_value=complete) as fetch:
            app = AppTest.from_file(APP).run()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            captions = "\n".join(item.value for item in app.caption)
            for text in ("Awaiting placement", "Off-rack / reserved", "Occupied / unidentified", "40s old at sync",
                         "Unknown observation time", "Last sensor report: Unknown", "Occupancy unknown / reserved",
                         "Unknown does not prove vacancy", "Observed (UTC):", observed):
                self.assertIn(text, captions)
            self.assertEqual(app.metric[0].value, "2")
            self.assertEqual(app.metric[1].label, "On rack (stock status)")
            self.assertEqual(app.metric[3].label, "Available slots (demo, at sync)")
            self.assertEqual(app.metric[3].value, "3")
            self.assertEqual(app.dataframe[1].value["occupancyUpdatedAt"].dtype.kind, "M")
            self.assertEqual([item.label for item in app.number_input], ["Low-stock threshold (local display only)"])
            app.number_input[0].set_value(60).run()
            self.assertFalse(app.exception)
            self.assertEqual(app.metric[3].value, "3")
            self.assertEqual(app.metric[0].value, "2")
            self.assertEqual(app.session_state["snapshot"], complete)
            self.assertEqual(fetch.call_count, 1)

    def test_old_manual_snapshot_is_explicitly_not_live(self):
        complete = snapshot()
        completed = complete["completed_at"] - timedelta(minutes=5)
        complete.update(started_at=completed, completed_at=completed)
        for row in complete["slots"]:
            row["occupancyUpdatedAt"] = completed.isoformat()
        with patch("firebase_client.FirebaseClient.fetch_snapshot", return_value=complete) as fetch:
            app = AppTest.from_file(APP).run()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertEqual(app.metric[3].value, "1")  # Available then, not a live claim.
            self.assertTrue(any("data may be stale" in item.value for item in app.warning))
            snapshot_age = next(item.value for item in app.caption
                                if item.value.startswith("Snapshot age at this render:"))
            self.assertGreaterEqual(float(snapshot_age.split(": ", 1)[1].split("s.", 1)[0]), 300)
            self.assertTrue(any("not live rack availability" in item.value for item in app.caption))
            self.assertTrue(any("0s old at sync" in item.value for item in app.caption))
            self.assertIn(completed.isoformat(), app.caption[0].value)
            app.run()
            self.assertFalse(app.exception)
            self.assertEqual(app.metric[3].value, "1")
            self.assertTrue(any("0s old at sync" in item.value for item in app.caption))
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(app.session_state["snapshot"], complete)

    def test_empty_snapshot_renders(self):
        with patch("firebase_client.FirebaseClient.fetch_snapshot", return_value=snapshot(empty=True)):
            app = AppTest.from_file(APP).run()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertEqual([metric.value for metric in app.metric], ["0", "0", "0", "0"])
            self.assertEqual(len(app.dataframe), 3)


if __name__ == "__main__":
    unittest.main()
