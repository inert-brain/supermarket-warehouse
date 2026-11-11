"""Pure reporting calculations; never read or repair inventory."""
from collections import Counter
from datetime import date, datetime

from firebase_client import STATUSES


def slot_cards(stocks, slots, reference_at):
    products = {row["productID"]: row for row in stocks}
    bindings = Counter(row["productID"] for row in slots if row["productID"] is not None)
    cards = []
    for slot_id in range(1, 9):
        matches = [row for row in slots if row["slotId"] == slot_id]
        card = {"slotId": slot_id, "productID": None, "status": "Unknown / awaiting rack update",
                "available": False, "isOccupied": None, "occupancyUpdatedAt": None,
                "observation_status": "Unknown observation time", "warning": None}
        if len(matches) == 1:
            row = matches[0]
            product = row["productID"]
            card.update(productID=product, isOccupied=row["isOccupied"],
                        occupancyUpdatedAt=row["occupancyUpdatedAt"])
            if row["occupancyUpdatedAt"] is not None:
                observed = datetime.fromisoformat(row["occupancyUpdatedAt"])
                age = (reference_at - observed).total_seconds()
                card["observation_status"] = ("Future timestamp / age unknown" if age < 0
                                              else f"{age:.0f}s old at sync")
            # Demo availability uses saved occupancy, not observation age or stock status.
            if product is None:
                if row["isOccupied"] is True:
                    card["status"] = "Occupied / unidentified"
                else:
                    card.update(status="Available (demo)", available=True)
            elif product in products and bindings[product] == 1 and row["assignedAt"] is not None:
                if row["isOccupied"] is None:
                    card["status"] = "Occupancy unknown / reserved"
                else:
                    status = products[product]["currentStatus"]
                    expected = {"OCCUPIED": True, "EMPTY": False, "PENDING_DISPATCH": False}
                    if row["isOccupied"] == expected[status]:
                        card["status"] = {"OCCUPIED": "Occupied", "EMPTY": "Awaiting placement",
                                          "PENDING_DISPATCH": "Off-rack / reserved"}[status]
                    else:
                        card["status"] = "Inconsistent / Sync again"
                        card["warning"] = (f"Slot {slot_id} saved sensor occupancy conflicts with {status} "
                                           f"product {product}; Sync again. No records were repaired.")
        cards.append(card)
    return cards


def stock_metrics(stocks, slots, reference_at):
    counts = Counter(row["currentStatus"] for row in stocks)
    return {
        "warehouse": counts["OCCUPIED"] + counts["PENDING_DISPATCH"],
        "on_rack": counts["OCCUPIED"],
        "pending_dispatch": counts["PENDING_DISPATCH"],
        "empty": counts["EMPTY"],
        "assigned_slots": sum(row["productID"] is not None for row in slots),
        "available_slots": sum(card["available"] for card in slot_cards(stocks, slots, reference_at)),
        "status_counts": {status: counts[status] for status in STATUSES},
    }


def quality_warnings(stocks, slots, reference_at):
    warnings = []
    products = {row["productID"]: row for row in stocks}
    slot_counts = Counter(row["slotId"] for row in slots)
    bindings = Counter(row["productID"] for row in slots if row["productID"] is not None)
    for slot_id in range(1, 9):
        if not slot_counts[slot_id]:
            warnings.append(f"Slot {slot_id} is missing; availability is Unknown.")
        elif slot_counts[slot_id] > 1:
            warnings.append(f"Slot {slot_id} has duplicate records; availability is Unknown.")
    for row in slots:
        slot_id, product = row["slotId"], row["productID"]
        if slot_id not in range(1, 9):
            warnings.append(f"Slot {slot_id} is outside the expected range 1–8.")
        if product is None and row["assignedAt"] is not None:
            warnings.append(f"Slot {slot_id} is unassigned but has assignedAt.")
        if product is not None:
            if row["assignedAt"] is None:
                warnings.append(f"Slot {slot_id} is assigned but has no assignedAt.")
            if product not in products:
                warnings.append(f"Slot {slot_id} references missing product {product}.")
    for product, count in bindings.items():
        if count > 1:
            warnings.append(f"Product {product} is bound to {count} slots.")
    for product, row in products.items():
        if row["currentStatus"] != "EMPTY" and not bindings[product]:
            warnings.append(f"{row['currentStatus']} product {product} has no slot binding.")
    warnings.extend(card["warning"] for card in slot_cards(stocks, slots, reference_at)
                    if card["warning"] is not None)
    return warnings


def expiry_label(value, today=None):
    if value is None:
        return "Missing expiry"
    return "Expired" if date.fromisoformat(value) < (today or date.today()) else "Valid through expiry date"
