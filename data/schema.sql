PRAGMA foreign_keys = ON;

CREATE TABLE Stocks (
    ProductID TEXT PRIMARY KEY NOT NULL,
    SlotID INTEGER NOT NULL UNIQUE CHECK (SlotID BETWEEN 1 AND 8),
    CurrentStatus TEXT NOT NULL DEFAULT 'EMPTY'
        CHECK (CurrentStatus IN ('EMPTY', 'OCCUPIED', 'PENDING_DISPATCH')),
    StatusUpdatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Description TEXT
);

CREATE TABLE Activities (
    ActivityID INTEGER PRIMARY KEY AUTOINCREMENT,
    ProductID TEXT NOT NULL REFERENCES Stocks (ProductID),
    OccurredAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ActivityType TEXT NOT NULL CHECK (
        ActivityType IN (
            'RECEIVED',
            'REMOVED_FROM_RACK',
            'RETURNED_TO_RACK',
            'DISPATCH_CONFIRMED'
        )
    )
);
