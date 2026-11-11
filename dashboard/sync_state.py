"""Atomic session snapshot publication, independent of Streamlit and networking."""
from firebase_client import SyncError


def sync_snapshot(state, client_factory):
    if state.get("sync_running", False):
        return False
    state["sync_running"] = True
    client = None
    try:
        client = client_factory()
        snapshot = client.fetch_snapshot()
        state["snapshot"] = snapshot
        state["sync_error"] = None
        return True
    except (SyncError, ValueError) as exc:
        state["sync_error"] = str(exc)
        return False
    finally:
        try:
            if client is not None:
                client.close()
        finally:
            state["sync_running"] = False
