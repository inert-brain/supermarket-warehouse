"""Offline shelf reads and failure handling; no Firebase calls."""
import unittest
from unittest.mock import Mock
from firestore_client import ShelfReadError, fetch_shelves

BASE = 'projects/mart-parking-fdd6b/databases/(default)/documents/products/'


def document(number):
    return {'document': {'name': BASE + f'SHELF_{number:03}', 'fields': {
        'capacity': {'integerValue': '5'}, 'partial': {'integerValue': '2'},
        'purchased': {'integerValue': '1'}, 'initialized': {'booleanValue': True}}}}


class ShelfTests(unittest.TestCase):
    def test_shelf_tab_keeps_snapshot_after_failed_refresh(self):
        from datetime import datetime, timezone
        from pathlib import Path
        from unittest.mock import patch
        from streamlit.testing.v1 import AppTest
        snapshot = {'shelves': [{'id': 'SHELF_01', 'fields': {'capacity': 5, 'partial': 2}}],
                    'completed_at': datetime.now(timezone.utc)}
        with patch('streamlit.secrets', {}), patch('firestore_client.fetch_shelves',
                side_effect=[snapshot, ShelfReadError('Read failed')]) as fetch:
            app = AppTest.from_file(str(Path(__file__).with_name('app.py'))).run()
            fetch.assert_not_called()
            app.button(key='sync_shelves').click().run()
            self.assertFalse(app.exception)
            self.assertEqual(app.metric[0].label, 'Capacity')
            self.assertEqual(app.metric[0].value, '5')
            app.button(key='sync_shelves').click().run()
            self.assertFalse(app.exception)
            self.assertTrue(app.error)
            self.assertEqual(app.session_state['shelf_snapshot'], snapshot)

    def test_pages_and_typed_contents(self):
        session = Mock()
        session.post.side_effect = [Mock(status_code=200, json=lambda: [document(i) for i in range(100)]),
                                    Mock(status_code=200, json=lambda: [document(100)])]
        result = fetch_shelves(session=session)
        self.assertEqual(len(result['shelves']), 101)
        self.assertEqual(result['shelves'][0]['fields'], {'capacity': 5, 'partial': 2, 'purchased': 1, 'initialized': True})
        query = session.post.call_args.kwargs['json']['structuredQuery']
        self.assertEqual(query['where']['compositeFilter']['filters'][-1]['fieldFilter']['value']['referenceValue'], BASE + 'SHELF_099')

    def test_empty_and_errors(self):
        session = Mock()
        session.post.return_value = Mock(status_code=200, json=lambda: [{'readTime': '2026-11-12T00:00:00Z'}])
        self.assertEqual(fetch_shelves(session=session)['shelves'], [])
        session.post.return_value = Mock(status_code=403)
        with self.assertRaises(ShelfReadError):
            fetch_shelves(session=session)
        session.post.return_value = Mock(status_code=200, json=lambda: [document(2), document(1)])
        with self.assertRaises(ShelfReadError):
            fetch_shelves(session=session)
