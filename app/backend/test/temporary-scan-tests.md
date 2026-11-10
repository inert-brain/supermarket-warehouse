mutation SeedStocks @transaction {
  product001: stock_insert(data: {
    productID: "WH-PROD-001"
    description: "Expired product"
    currentStatus: EMPTY
    expiresOn: "2026-11-09"
  })

  product002: stock_insert(data: {
    productID: "WH-PROD-002"
    description: "Expires today"
    currentStatus: EMPTY
    expiresOn: "2026-11-10"
  })

  product003: stock_insert(data: {
    productID: "WH-PROD-003"
    description: "Valid unassigned product"
    currentStatus: EMPTY
    expiresOn: "2026-11-11"
  })

  product004: stock_insert(data: {
    productID: "WH-PROD-004"
    description: "Missing expiration date"
    currentStatus: EMPTY
    expiresOn: null
  })

  product005: stock_insert(data: {
    productID: "WH-PROD-005"
    description: "Product on the rack"
    currentStatus: OCCUPIED
    expiresOn: "2026-11-11"
  })

  product006: stock_insert(data: {
    productID: "WH-PROD-006"
    description: "Product pending dispatch"
    currentStatus: PENDING_DISPATCH
    expiresOn: "2026-11-11"
  })

  product007: stock_insert(data: {
    productID: "WH-PROD-007"
    description: "Valid barcode test product"
    currentStatus: EMPTY
    expiresOn: "2026-11-11"
  })
}



mutation BindTestProduct {
  slot_update(
    key: { slotId: 1 }
    data: {
      productID: "WH-PROD-005"
      assignedAt_expr: "request.time"
    }
  )
}
