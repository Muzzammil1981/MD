USE [MaintenenceModule];
GO

/* =====================================================================
   v3: customer reviews (one per COMPLETED order; shown on the home page
   and on every design that was part of that order)
   ===================================================================== */
IF OBJECT_ID(N'mehndi.Reviews', N'U') IS NULL
CREATE TABLE mehndi.Reviews (
    Id        NVARCHAR(40)   NOT NULL CONSTRAINT PK_Reviews PRIMARY KEY,
    OrderId   NVARCHAR(40)   NOT NULL CONSTRAINT FK_Reviews_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    UserId    NVARCHAR(40)   NOT NULL CONSTRAINT FK_Reviews_User  REFERENCES mehndi.Users(Id),
    Username  NVARCHAR(100)  NOT NULL,
    Rating    TINYINT        NOT NULL,
    Comment   NVARCHAR(1000) NOT NULL CONSTRAINT DF_Reviews_Comment DEFAULT (N''),
    Hidden    BIT            NOT NULL CONSTRAINT DF_Reviews_Hidden DEFAULT (0),
    CreatedAt DATETIME2(3)   NOT NULL CONSTRAINT DF_Reviews_Created DEFAULT (SYSUTCDATETIME()),
    UpdatedAt DATETIME2(3)   NULL,
    CONSTRAINT CK_Reviews_Rating CHECK (Rating BETWEEN 1 AND 5)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Reviews_Order')
    CREATE UNIQUE INDEX UX_Reviews_Order ON mehndi.Reviews (OrderId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Reviews_Visible')
    CREATE INDEX IX_Reviews_Visible ON mehndi.Reviews (Hidden, CreatedAt DESC);
GO

/* which designs a review is about (the designs in that order) */
IF OBJECT_ID(N'mehndi.ReviewDesigns', N'U') IS NULL
CREATE TABLE mehndi.ReviewDesigns (
    ReviewId NVARCHAR(40)  NOT NULL CONSTRAINT FK_ReviewDesigns_Review REFERENCES mehndi.Reviews(Id) ON DELETE CASCADE,
    DesignId NVARCHAR(150) NOT NULL CONSTRAINT FK_ReviewDesigns_Design REFERENCES mehndi.Designs(Id) ON DELETE CASCADE,
    CONSTRAINT PK_ReviewDesigns PRIMARY KEY (ReviewId, DesignId)
);
GO
