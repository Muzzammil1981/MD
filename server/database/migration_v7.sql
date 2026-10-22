USE [MaintenenceModule];
GO

/* =====================================================================
   v7: which industries an Admin may work in
   - AdminIndustries   admin <-> industry (chosen by the SuperAdmin)
   - Orders.IndustryKey / Events.IndustryKey   the industry an order / event belongs to
   An Admin only gets orders, reviews, reports and catalogue of THEIR industries.
   ===================================================================== */
IF OBJECT_ID(N'mehndi.AdminIndustries', N'U') IS NULL
CREATE TABLE mehndi.AdminIndustries (
    AdminId     NVARCHAR(40) NOT NULL CONSTRAINT FK_AdminIndustries_User REFERENCES mehndi.Users(Id) ON DELETE CASCADE,
    IndustryKey NVARCHAR(50) NOT NULL,
    AssignedAt  DATETIME2(3) NOT NULL CONSTRAINT DF_AdminIndustries_At DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_AdminIndustries PRIMARY KEY (AdminId, IndustryKey)
);
GO
IF COL_LENGTH(N'mehndi.Orders', N'IndustryKey') IS NULL
    ALTER TABLE mehndi.Orders ADD IndustryKey NVARCHAR(50) NULL;
GO
IF COL_LENGTH(N'mehndi.Events', N'IndustryKey') IS NULL
    ALTER TABLE mehndi.Events ADD IndustryKey NVARCHAR(50) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_Industry')
    CREATE INDEX IX_Orders_Industry ON mehndi.Orders (IndustryKey, CreatedAt DESC);
GO

/* Existing orders, events and admins belong to the industry that is active now
   (the server also does this automatically on start). */
UPDATE mehndi.Orders SET IndustryKey = ISNULL((SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1), 'mehndi') WHERE IndustryKey IS NULL;
UPDATE mehndi.Events SET IndustryKey = ISNULL((SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1), 'mehndi') WHERE IndustryKey IS NULL;
INSERT INTO mehndi.AdminIndustries (AdminId, IndustryKey)
SELECT u.Id, ISNULL((SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1), 'mehndi')
FROM mehndi.Users u
WHERE u.Role = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM mehndi.AdminIndustries ai WHERE ai.AdminId = u.Id);
GO
