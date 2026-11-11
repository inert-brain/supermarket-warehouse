"""Pure reporting calculations; never read or repair inventory."""
from collections import Counter
from datetime import date

from firebase_client import STATUSES


def slot_cards(stocks, slots):
    products = {row["productID"]: row for row in stocks}
    bindings = Counter(row["productID"] for row in slots if row["productID"] is not None)
    cards = []
    for slot_id in range(1, 9):
        matches = [row for row in slots if row["slotId"] == slot_id]
        card = {"slotId": slot_id, "productID": None, "status": "Unknown", "available": False}
        if len(matches) == 1:
            row = matches[0]
            product = row["productID"]
            card["productID"] = product
            if product is None and row["assignedAt"] is None:
                card.update(status="Unassigned", available=True)
            elif product in products and bindings[product] == 1 and row["assignedAt"] is not None:
                status = products[product]["currentStatus"]
                if status != "EMPTY":
                    card["status"] = status
        cards.append(card)
    return cards


def stock_metrics(stocks, slots):
    counts = Counter(row["currentStatus"] for row in stocks)
    return {
        "warehouse": counts["OCCUPIED"] + counts["PENDING_DISPATCH"],
        "on_rack": counts["OCCUPIED"],
        "pending_dispatch": counts["PENDING_DISPATCH"],
        "empty": counts["EMPTY"],
        "assigned_slots": sum(row["productID"] is not None for row in slots),
        "unassigned_slots": sum(card["available"] for card in slot_cards(stocks, slots)),
        "status_counts": {status: counts[status] for status in STATUSES},
    }


def quality_warnings(stocks, slots):
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
        if row["currentStatus"] == "EMPTY" and bindings[product]:
            warnings.append(f"EMPTY product {product} still has a slot binding.")
        elif row["currentStatus"] != "EMPTY" and not bindings[product]:
            warnings.append(f"{row['currentStatus']} product {product} has no slot binding.")
    return warnings


def expiry_label(value, today=None):
    if value is None:
        return "Missing expiry"
    return "Expired" if date.fromisoformat(value) < (today or date.today()) else "Valid through expiry date"
