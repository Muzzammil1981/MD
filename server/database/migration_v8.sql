USE [MaintenenceModule];
GO

/* =====================================================================
   v8: every business has its own address (/slug) and its own opening hours
   - IndustrySettings   public slug + published flag + order in the directory
   - IndustrySchedule   opening hours / slot step / stations / closed days PER business
   ===================================================================== */
IF OBJECT_ID(N'mehndi.IndustrySettings', N'U') IS NULL
CREATE TABLE mehndi.IndustrySettings (
    IndustryKey NVARCHAR(50)  NOT NULL CONSTRAINT PK_IndustrySettings PRIMARY KEY,
    Slug        NVARCHAR(60)  NOT NULL,
    Published   BIT           NOT NULL CONSTRAINT DF_IndSettings_Published DEFAULT (0),
    SortOrder   INT           NOT NULL CONSTRAINT DF_IndSettings_Sort DEFAULT (0),
    UpdatedAt   DATETIME2(3)  NOT NULL CONSTRAINT DF_IndSettings_Updated DEFAULT (SYSUTCDATETIME())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_IndustrySettings_Slug')
    CREATE UNIQUE INDEX UX_IndustrySettings_Slug ON mehndi.IndustrySettings (Slug);
GO

IF OBJECT_ID(N'mehndi.IndustrySchedule', N'U') IS NULL
CREATE TABLE mehndi.IndustrySchedule (
    IndustryKey NVARCHAR(50) NOT NULL CONSTRAINT PK_IndustrySchedule PRIMARY KEY,
    OpenTime    CHAR(5)      NOT NULL CONSTRAINT DF_IndSched_Open  DEFAULT ('09:00'),
    CloseTime   CHAR(5)      NOT NULL CONSTRAINT DF_IndSched_Close DEFAULT ('20:00'),
    SlotMinutes INT          NOT NULL CONSTRAINT DF_IndSched_Slot  DEFAULT (30),
    Stations    INT          NOT NULL CONSTRAINT DF_IndSched_Stat  DEFAULT (1),
    ClosedDays  VARCHAR(20)  NOT NULL CONSTRAINT DF_IndSched_Closed DEFAULT (''),
    AdvanceDays INT          NOT NULL CONSTRAINT DF_IndSched_Adv   DEFAULT (30),
    UpdatedAt   DATETIME2(3) NOT NULL CONSTRAINT DF_IndSched_Updated DEFAULT (SYSUTCDATETIME())
);
GO

/* The server fills these tables for every industry on start (slug = industry key, published if it has categories). */
