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


class ProductTests(unittest.TestCase):
    def test_barcode_resolves_workspace_product(self):
        from unittest.mock import patch
        from firestore_client import fetch_product
        doc = {'name': 'projects/test/databases/(default)/documents/shoppingCartWorkspaces/shopping-cart/products/P003',
               'fields': {'barcode': {'stringValue': 'DEMO003'}, 'name': {'stringValue': 'Bread'},
                          'priceCentavos': {'integerValue': '5800'}}}
        with patch('firestore_client.requests.post', return_value=Mock(status_code=200, json=lambda: [{'document': doc}])) as post, \
                patch('firestore_client.requests.get') as get:
            result = fetch_product('DEMO003')
            self.assertEqual(result['id'], 'P003')
            self.assertEqual(result['name'], 'Bread')
            self.assertEqual(result['priceCentavos'], 5800)
            self.assertTrue(post.call_args.args[0].endswith('/shoppingCartWorkspaces/shopping-cart:runQuery'))
            self.assertEqual(post.call_args.kwargs['json']['structuredQuery']['where']['fieldFilter']['value']['stringValue'], 'DEMO003')
            get.assert_not_called()

    def test_document_id_fallback_and_not_found(self):
        from unittest.mock import patch
        from firestore_client import fetch_product
        doc = {'name': 'projects/test/databases/(default)/documents/shoppingCartWorkspaces/shopping-cart/products/P003', 'fields': {}}
        with patch('firestore_client.requests.post', return_value=Mock(status_code=200, json=lambda: [])), \
                patch('firestore_client.requests.get', return_value=Mock(status_code=200, json=lambda: doc)) as get:
            self.assertEqual(fetch_product('P003')['id'], 'P003')
            self.assertTrue(get.call_args.args[0].endswith('/shoppingCartWorkspaces/shopping-cart/products/P003'))
            get.return_value = Mock(status_code=404)
            with self.assertRaises(ShelfReadError):
                fetch_product('MISSING')


class ShelfAlertTests(unittest.TestCase):
    def test_overview_alerts_use_remaining_counts_and_shared_shelf_sync(self):
        from datetime import datetime, timezone
        from pathlib import Path
        from unittest.mock import patch
        from streamlit.testing.v1 import AppTest
        snapshot = {'shelves': [
            {'id': 'SHELF_01', 'fields': {'capacity': 5, 'remaining': 1}},
            {'id': 'SHELF_02', 'fields': {'capacity': 1, 'remaining': 2}},
            {'id': 'SHELF_03', 'fields': {'capacity': 5, 'remaining': 0}},
        ], 'completed_at': datetime.now(timezone.utc)}
        with patch('streamlit.secrets', {}), patch('firestore_client.fetch_shelves', return_value=snapshot) as fetch:
            app = AppTest.from_file(str(Path(__file__).with_name('app.py'))).run()
            fetch.assert_not_called()
            app.button(key='sync_shelf_alerts').click().run()
            self.assertFalse(app.exception)
            text = '\n'.join(item.value for item in app.markdown)
            self.assertIn('Shelf 1 · Milk — LOW STOCK: 1 remaining.', text)
            self.assertIn('Shelf 3 · Juices — OUT OF STOCK: 0 remaining.', text)
            self.assertIn('Shelf 2 · Cereal: 2 remaining · stock OK', text)
            self.assertNotIn('Shelf 2 · Cereal — LOW STOCK', text)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(app.session_state['shelf_snapshot'], snapshot)
            snapshot['shelves'][0]['fields'].pop('remaining')
            app.button(key='sync_shelves').click().run()
            self.assertTrue(any('Shelf 1 · Milk: remaining count unavailable.' in item.value for item in app.info))
