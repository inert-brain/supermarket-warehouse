"""Headless Streamlit integration tests; no server or Firebase access required."""
from datetime import datetime, timezone
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
            "slots": [] if empty else [slot(1, "p1"), slot(2)],
            "activities": [] if empty else [activity(), dict(activity(2), activityType="REMOVED")],
            "started_at": now, "completed_at": now}


class AppTests(unittest.TestCase):
    def setUp(self):
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

    def test_empty_snapshot_renders(self):
        with patch("firebase_client.FirebaseClient.fetch_snapshot", return_value=snapshot(empty=True)):
            app = AppTest.from_file(APP).run()
            app.button[0].click().run()
            self.assertFalse(app.exception)
            self.assertEqual([metric.value for metric in app.metric], ["0", "0", "0", "0"])
            self.assertEqual(len(app.dataframe), 3)


if __name__ == "__main__":
    unittest.main()
