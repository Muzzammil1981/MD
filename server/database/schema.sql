/* =====================================================================
   Mehndi Studio - SQL Server schema (idempotent: safe to run many times)
   Everything that used to live in Google Drive .json / .xlsx files is a
   real table here. Only image FILES live on disk (/uploads); the tables
   store just the relative path of each image.
   ===================================================================== */

/* All tables live in their own schema so they never clash with existing tables */
IF SCHEMA_ID(N'mehndi') IS NULL EXEC(N'CREATE SCHEMA mehndi');
GO

/* ---------------------------------------------------------------- Users */
IF OBJECT_ID(N'mehndi.Users', N'U') IS NULL
CREATE TABLE mehndi.Users (
    Id                NVARCHAR(40)   NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    Username          NVARCHAR(100)  NOT NULL,
    Email             NVARCHAR(200)  NULL,
    FullName          NVARCHAR(200)  NOT NULL CONSTRAINT DF_Users_FullName DEFAULT (N''),
    PasswordHash      NVARCHAR(200)  NOT NULL,
    Role              VARCHAR(20)    NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('USER'),
    Active            BIT            NOT NULL CONSTRAINT DF_Users_Active DEFAULT (1),
    CreatedBy         NVARCHAR(40)   NULL,
    CreatedAt         DATETIME2(3)   NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    LastLogin         DATETIME2(3)   NULL,
    PasswordChangedAt DATETIME2(3)   NULL,
    CONSTRAINT CK_Users_Role CHECK (Role IN ('SUPERADMIN','ADMIN','USER'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_Username')
    CREATE UNIQUE INDEX UX_Users_Username ON mehndi.Users (Username);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_Email')
    CREATE UNIQUE INDEX UX_Users_Email ON mehndi.Users (Email) WHERE Email IS NOT NULL;
GO

/* ----------------------------------------------------------- Categories */
IF OBJECT_ID(N'mehndi.Categories', N'U') IS NULL
CREATE TABLE mehndi.Categories (
    Id          VARCHAR(50)    NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
    Name        NVARCHAR(100)  NOT NULL,
    ShortName   NVARCHAR(50)   NOT NULL,
    FolderName  NVARCHAR(50)   NOT NULL,
    Description NVARCHAR(500)  NOT NULL,
    Accent      NVARCHAR(100)  NOT NULL,
    SortOrder   INT            NOT NULL CONSTRAINT DF_Categories_Sort DEFAULT (0)
);
GO

/* -------------------------------------------------------------- Designs */
IF OBJECT_ID(N'mehndi.Designs', N'U') IS NULL
CREATE TABLE mehndi.Designs (
    Id          NVARCHAR(150)  NOT NULL CONSTRAINT PK_Designs PRIMARY KEY,
    Name        NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Designs_Desc DEFAULT (N''),
    Price       DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Designs_Price DEFAULT (0),
    AmountType  NVARCHAR(50)   NOT NULL CONSTRAINT DF_Designs_AmtType DEFAULT (N'per design'),
    CategoryId  VARCHAR(50)    NOT NULL CONSTRAINT FK_Designs_Category REFERENCES mehndi.Categories(Id),
    Featured    BIT            NOT NULL CONSTRAINT DF_Designs_Featured DEFAULT (0),
    ImagePath   NVARCHAR(300)  NOT NULL,   -- e.g. /uploads/designs/arabic/arabic-1-123.webp
    ThumbPath   NVARCHAR(300)  NOT NULL,   -- e.g. /uploads/designs/arabic/thumbs/arabic-1-123.webp
    CreatedAt   DATETIME2(3)   NOT NULL CONSTRAINT DF_Designs_CreatedAt DEFAULT (SYSUTCDATETIME())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Designs_Category')
    CREATE INDEX IX_Designs_Category ON mehndi.Designs (CategoryId, CreatedAt DESC);
GO

/* --------------------------------------------- Custom reference images */
IF OBJECT_ID(N'mehndi.CustomImages', N'U') IS NULL
CREATE TABLE mehndi.CustomImages (
    Id          NVARCHAR(150)  NOT NULL CONSTRAINT PK_CustomImages PRIMARY KEY,
    ImagePath   NVARCHAR(300)  NOT NULL,
    ThumbPath   NVARCHAR(300)  NOT NULL,
    ContentType NVARCHAR(100)  NOT NULL,
    CreatedAt   DATETIME2(3)   NOT NULL CONSTRAINT DF_CustomImages_CreatedAt DEFAULT (SYSUTCDATETIME())
);
GO

/* ------------------------------------------------------ Studio settings */
IF OBJECT_ID(N'mehndi.StudioSettings', N'U') IS NULL
CREATE TABLE mehndi.StudioSettings (
    Id           INT            NOT NULL CONSTRAINT PK_StudioSettings PRIMARY KEY,
    UpiId        NVARCHAR(100)  NOT NULL CONSTRAINT DF_Settings_Upi DEFAULT (N''),
    MerchantName NVARCHAR(150)  NOT NULL CONSTRAINT DF_Settings_Merchant DEFAULT (N'Mehndi Studio'),
    QrImagePath  NVARCHAR(300)  NULL,
    UpdatedAt    DATETIME2(3)   NOT NULL CONSTRAINT DF_Settings_Updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_StudioSettings_Single CHECK (Id = 1)
);
GO
IF NOT EXISTS (SELECT 1 FROM mehndi.StudioSettings WHERE Id = 1)
    INSERT INTO mehndi.StudioSettings (Id) VALUES (1);
GO

/* --------------------------------------------------------------- Events */
IF OBJECT_ID(N'mehndi.Events', N'U') IS NULL
CREATE TABLE mehndi.Events (
    Id           NVARCHAR(100)  NOT NULL CONSTRAINT PK_Events PRIMARY KEY,
    Name         NVARCHAR(200)  NOT NULL,
    StartDate    DATETIME2(3)   NOT NULL,
    EndDate      DATETIME2(3)   NOT NULL,
    AllDesigns   BIT            NOT NULL CONSTRAINT DF_Events_All DEFAULT (0),
    TokenCounter INT            NOT NULL CONSTRAINT DF_Events_Token DEFAULT (0),
    CreatedAt    DATETIME2(3)   NOT NULL CONSTRAINT DF_Events_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt    DATETIME2(3)   NULL
);
GO

IF OBJECT_ID(N'mehndi.EventDesigns', N'U') IS NULL
CREATE TABLE mehndi.EventDesigns (
    EventId  NVARCHAR(100) NOT NULL CONSTRAINT FK_EventDesigns_Event  REFERENCES mehndi.Events(Id)  ON DELETE CASCADE,
    DesignId NVARCHAR(150) NOT NULL CONSTRAINT FK_EventDesigns_Design REFERENCES mehndi.Designs(Id) ON DELETE CASCADE,
    CONSTRAINT PK_EventDesigns PRIMARY KEY (EventId, DesignId)
);
GO

IF OBJECT_ID(N'mehndi.EventPriceOverrides', N'U') IS NULL
CREATE TABLE mehndi.EventPriceOverrides (
    EventId  NVARCHAR(100) NOT NULL CONSTRAINT FK_EventPrice_Event  REFERENCES mehndi.Events(Id)  ON DELETE CASCADE,
    DesignId NVARCHAR(150) NOT NULL CONSTRAINT FK_EventPrice_Design REFERENCES mehndi.Designs(Id) ON DELETE CASCADE,
    Price    DECIMAL(12,2) NOT NULL,
    CONSTRAINT PK_EventPriceOverrides PRIMARY KEY (EventId, DesignId)
);
GO

/* -------------------------------------- Daily token counter (non-event) */
IF OBJECT_ID(N'mehndi.DailyTokens', N'U') IS NULL
CREATE TABLE mehndi.DailyTokens (
    TokenDate DATE NOT NULL CONSTRAINT PK_DailyTokens PRIMARY KEY,
    Counter   INT  NOT NULL CONSTRAINT DF_DailyTokens_Counter DEFAULT (0)
);
GO

/* --------------------------------------------------------------- Orders */
IF OBJECT_ID(N'mehndi.Orders', N'U') IS NULL
CREATE TABLE mehndi.Orders (
    Id                   NVARCHAR(40)   NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    UserId               NVARCHAR(40)   NOT NULL CONSTRAINT FK_Orders_User REFERENCES mehndi.Users(Id),
    Username             NVARCHAR(100)  NOT NULL,
    Email                NVARCHAR(200)  NULL,
    Type                 VARCHAR(20)    NOT NULL CONSTRAINT DF_Orders_Type DEFAULT ('standard'),
    IsGroup              BIT            NOT NULL CONSTRAINT DF_Orders_IsGroup DEFAULT (0),
    Total                DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Orders_Total DEFAULT (0),
    PaidAmount           DECIMAL(12,2)  NOT NULL CONSTRAINT DF_Orders_Paid DEFAULT (0),
    PreviousTotal        DECIMAL(12,2)  NULL,
    TotalDifference      DECIMAL(12,2)  NULL,
    RequestedDate        NVARCHAR(30)   NULL,
    RequestedTime        NVARCHAR(30)   NULL,
    Notes                NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Orders_Notes DEFAULT (N''),
    Status               VARCHAR(30)    NOT NULL CONSTRAINT DF_Orders_Status DEFAULT ('pending'),
    PaymentMethod        VARCHAR(10)    NOT NULL CONSTRAINT DF_Orders_PayMethod DEFAULT ('upi'),
    EventId              NVARCHAR(100)  NULL CONSTRAINT FK_Orders_Event REFERENCES mehndi.Events(Id) ON DELETE SET NULL,
    TokenNumber          INT            NULL,
    AdminNote            NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Orders_AdminNote DEFAULT (N''),
    ProposedDate         NVARCHAR(30)   NOT NULL CONSTRAINT DF_Orders_PropDate DEFAULT (N''),
    ProposedTime         NVARCHAR(30)   NOT NULL CONSTRAINT DF_Orders_PropTime DEFAULT (N''),
    -- custom design requests
    CustomDescription    NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_Orders_CustDesc DEFAULT (N''),
    CustomImageId        NVARCHAR(150)  NULL,
    CustomImage          NVARCHAR(300)  NULL,
    SuggestedPrice       DECIMAL(12,2)  NULL,
    QuotedPrice          DECIMAL(12,2)  NULL,
    -- payment
    Utr                  NVARCHAR(60)   NOT NULL CONSTRAINT DF_Orders_Utr DEFAULT (N''),
    PaymentClaimedAt     DATETIME2(3)   NULL,
    PaymentId            NVARCHAR(60)   NOT NULL CONSTRAINT DF_Orders_PayId DEFAULT (N''),
    PaidAt               DATETIME2(3)   NULL,
    PaymentRejectReason  NVARCHAR(500)  NOT NULL CONSTRAINT DF_Orders_RejReason DEFAULT (N''),
    PaymentRejectedAt    DATETIME2(3)   NULL,
    RefundGivenAt        DATETIME2(3)   NULL,
    -- work session (single orders)
    StartedAt            DATETIME2(3)   NULL,
    EndedAt              DATETIME2(3)   NULL,
    DurationSeconds      INT            NOT NULL CONSTRAINT DF_Orders_Duration DEFAULT (0),
    WorkNote             NVARCHAR(MAX)  NULL,
    CreatedAt            DATETIME2(3)   NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt            DATETIME2(3)   NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT (SYSUTCDATETIME())
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_User')
    CREATE INDEX IX_Orders_User ON mehndi.Orders (UserId, CreatedAt DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Event')
    CREATE INDEX IX_Orders_Event ON mehndi.Orders (EventId, Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orders_Status')
    CREATE INDEX IX_Orders_Status ON mehndi.Orders (Status, CreatedAt DESC);
GO

/* --------------------------------------------- Group members of an order */
IF OBJECT_ID(N'mehndi.OrderMembers', N'U') IS NULL
CREATE TABLE mehndi.OrderMembers (
    OrderId         NVARCHAR(40)   NOT NULL CONSTRAINT FK_OrderMembers_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    MemberId        NVARCHAR(60)   NOT NULL,
    SortOrder       INT            NOT NULL CONSTRAINT DF_OrderMembers_Sort DEFAULT (0),
    Name            NVARCHAR(200)  NOT NULL,
    Subtotal        DECIMAL(12,2)  NOT NULL CONSTRAINT DF_OrderMembers_Sub DEFAULT (0),
    TokenNumber     INT            NULL,
    Status          VARCHAR(20)    NOT NULL CONSTRAINT DF_OrderMembers_Status DEFAULT ('pending'),
    StartedAt       DATETIME2(3)   NULL,
    EndedAt         DATETIME2(3)   NULL,
    DurationSeconds INT            NOT NULL CONSTRAINT DF_OrderMembers_Dur DEFAULT (0),
    CONSTRAINT PK_OrderMembers PRIMARY KEY (OrderId, MemberId)
);
GO

/* ------------------------------ Order lines (single order or per member) */
IF OBJECT_ID(N'mehndi.OrderItems', N'U') IS NULL
CREATE TABLE mehndi.OrderItems (
    Id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
    OrderId      NVARCHAR(40)   NOT NULL CONSTRAINT FK_OrderItems_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    MemberId     NVARCHAR(60)   NULL,          -- NULL for a normal (non-group) order
    SortOrder    INT            NOT NULL CONSTRAINT DF_OrderItems_Sort DEFAULT (0),
    DesignId     NVARCHAR(150)  NULL,          -- snapshot: no FK so deleting a design keeps history
    Name         NVARCHAR(200)  NOT NULL,
    Price        DECIMAL(12,2)  NOT NULL,
    Qty          INT            NOT NULL,
    Image        NVARCHAR(300)  NULL,
    CategoryName NVARCHAR(100)  NULL,
    AmountType   NVARCHAR(50)   NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrderItems_Order')
    CREATE INDEX IX_OrderItems_Order ON mehndi.OrderItems (OrderId);
GO

/* ------------------------------------------ Custom-quote negotiation log */
IF OBJECT_ID(N'mehndi.OrderNegotiations', N'U') IS NULL
CREATE TABLE mehndi.OrderNegotiations (
    Id      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderNegotiations PRIMARY KEY,
    OrderId NVARCHAR(40)  NOT NULL CONSTRAINT FK_OrderNeg_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    At      DATETIME2(3)  NOT NULL CONSTRAINT DF_OrderNeg_At DEFAULT (SYSUTCDATETIME()),
    ByRole  VARCHAR(20)   NOT NULL,            -- 'admin' | 'customer'
    Action  VARCHAR(20)   NOT NULL,            -- accept | counter | reject | decline
    Price   DECIMAL(12,2) NULL,
    Note    NVARCHAR(MAX) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrderNeg_Order')
    CREATE INDEX IX_OrderNeg_Order ON mehndi.OrderNegotiations (OrderId, At);
GO

/* --------------------------------------- Order modification history (+lines) */
IF OBJECT_ID(N'mehndi.OrderModifications', N'U') IS NULL
CREATE TABLE mehndi.OrderModifications (
    Id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderModifications PRIMARY KEY,
    OrderId            NVARCHAR(40)  NOT NULL CONSTRAINT FK_OrderMod_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    At                 DATETIME2(3)  NOT NULL CONSTRAINT DF_OrderMod_At DEFAULT (SYSUTCDATETIME()),
    PreviousTotal      DECIMAL(12,2) NOT NULL,
    NewTotal           DECIMAL(12,2) NOT NULL,
    Difference         DECIMAL(12,2) NOT NULL,
    PreviousStatus     VARCHAR(30)   NOT NULL,
    PreviousPaidAmount DECIMAL(12,2) NOT NULL
);
GO
IF OBJECT_ID(N'mehndi.OrderModificationItems', N'U') IS NULL
CREATE TABLE mehndi.OrderModificationItems (
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderModItems PRIMARY KEY,
    ModificationId BIGINT        NOT NULL CONSTRAINT FK_OrderModItems_Mod REFERENCES mehndi.OrderModifications(Id) ON DELETE CASCADE,
    Side           VARCHAR(8)    NOT NULL,     -- 'previous' | 'new'
    SortOrder      INT           NOT NULL CONSTRAINT DF_OrderModItems_Sort DEFAULT (0),
    DesignId       NVARCHAR(150) NULL,
    Name           NVARCHAR(200) NOT NULL,
    Price          DECIMAL(12,2) NOT NULL,
    Qty            INT           NOT NULL,
    Image          NVARCHAR(300) NULL,
    CategoryName   NVARCHAR(100) NULL,
    AmountType     NVARCHAR(50)  NULL,
    CONSTRAINT CK_OrderModItems_Side CHECK (Side IN ('previous','new'))
);
GO

/* ------------------------------------------------------ Refund history */
IF OBJECT_ID(N'mehndi.OrderRefunds', N'U') IS NULL
CREATE TABLE mehndi.OrderRefunds (
    Id      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderRefunds PRIMARY KEY,
    OrderId NVARCHAR(40)  NOT NULL CONSTRAINT FK_OrderRefunds_Order REFERENCES mehndi.Orders(Id) ON DELETE CASCADE,
    At      DATETIME2(3)  NOT NULL CONSTRAINT DF_OrderRefunds_At DEFAULT (SYSUTCDATETIME()),
    Amount  DECIMAL(12,2) NOT NULL,
    Note    NVARCHAR(MAX) NULL
);
GO

/* ------------------------------------------------------------ Ad campaigns */
IF OBJECT_ID(N'mehndi.AdCampaigns', N'U') IS NULL
CREATE TABLE mehndi.AdCampaigns (
    Id                NVARCHAR(40)   NOT NULL CONSTRAINT PK_AdCampaigns PRIMARY KEY,
    EventId           NVARCHAR(100)  NOT NULL CONSTRAINT FK_AdCampaigns_Event REFERENCES mehndi.Events(Id) ON DELETE CASCADE,
    AdvertiserName    NVARCHAR(200)  NOT NULL,
    AdvertiserContact NVARCHAR(200)  NOT NULL CONSTRAINT DF_AdCamp_Contact DEFAULT (N''),
    CampaignTitle     NVARCHAR(200)  NOT NULL CONSTRAINT DF_AdCamp_Title DEFAULT (N''),
    PlayMode          VARCHAR(30)    NOT NULL,
    IntervalMinutes   INT            NULL,
    CostPerPlay       DECIMAL(12,2)  NOT NULL CONSTRAINT DF_AdCamp_Cost DEFAULT (0),
    Paid              BIT            NOT NULL CONSTRAINT DF_AdCamp_Paid DEFAULT (0),
    Active            BIT            NOT NULL CONSTRAINT DF_AdCamp_Active DEFAULT (1),
    LastPlayedAt      DATETIME2(3)   NULL,
    CreatedAt         DATETIME2(3)   NOT NULL CONSTRAINT DF_AdCamp_Created DEFAULT (SYSUTCDATETIME()),
    UpdatedAt         DATETIME2(3)   NOT NULL CONSTRAINT DF_AdCamp_Updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_AdCampaigns_PlayMode CHECK (PlayMode IN ('no-session','interval','no-session-and-interval'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdCampaigns_Event')
    CREATE INDEX IX_AdCampaigns_Event ON mehndi.AdCampaigns (EventId, Active);
GO

IF OBJECT_ID(N'mehndi.AdVideos', N'U') IS NULL
CREATE TABLE mehndi.AdVideos (
    Id               NVARCHAR(40)   NOT NULL CONSTRAINT PK_AdVideos PRIMARY KEY,
    CampaignId       NVARCHAR(40)   NOT NULL CONSTRAINT FK_AdVideos_Campaign REFERENCES mehndi.AdCampaigns(Id) ON DELETE CASCADE,
    SortOrder        INT            NOT NULL CONSTRAINT DF_AdVideos_Sort DEFAULT (0),
    Url              NVARCHAR(1000) NOT NULL,
    EmbedUrl         NVARCHAR(1000) NOT NULL,
    Title            NVARCHAR(200)  NOT NULL,
    DurationSeconds  INT            NOT NULL,
    PurchasedPlays   INT            NOT NULL,
    PlaysCompleted   INT            NOT NULL CONSTRAINT DF_AdVideos_Done DEFAULT (0),
    PlaysInterrupted INT            NOT NULL CONSTRAINT DF_AdVideos_Int DEFAULT (0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdVideos_Campaign')
    CREATE INDEX IX_AdVideos_Campaign ON mehndi.AdVideos (CampaignId, SortOrder);
GO

IF OBJECT_ID(N'mehndi.AdRuns', N'U') IS NULL
CREATE TABLE mehndi.AdRuns (
    Id                     NVARCHAR(40)  NOT NULL CONSTRAINT PK_AdRuns PRIMARY KEY,
    CampaignId             NVARCHAR(40)  NOT NULL CONSTRAINT FK_AdRuns_Campaign REFERENCES mehndi.AdCampaigns(Id) ON DELETE CASCADE,
    VideoId                NVARCHAR(40)  NOT NULL,
    VideoTitle             NVARCHAR(200) NOT NULL,
    StartedAt              DATETIME2(3)  NOT NULL,
    EndedAt                DATETIME2(3)  NULL,
    DurationSeconds        INT           NOT NULL CONSTRAINT DF_AdRuns_Dur DEFAULT (0),
    PlannedDurationSeconds INT           NOT NULL,
    Completed              BIT           NOT NULL CONSTRAINT DF_AdRuns_Done DEFAULT (0),
    Rejected               BIT           NOT NULL CONSTRAINT DF_AdRuns_Rej DEFAULT (0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdRuns_Campaign')
    CREATE INDEX IX_AdRuns_Campaign ON mehndi.AdRuns (CampaignId, StartedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdRuns_Open')
    CREATE INDEX IX_AdRuns_Open ON mehndi.AdRuns (EndedAt) WHERE EndedAt IS NULL;
GO

/* Categories are seeded by the server from the INDUSTRY profile (src/config/industries.js) */

/* =====================================================================
   v2: ownership (who created an event / uploaded a design) + per-admin
   payment settings.  These are safe upgrades: existing data is kept.
   ===================================================================== */
IF COL_LENGTH(N'mehndi.Designs', N'UploadedBy') IS NULL
    ALTER TABLE mehndi.Designs ADD UploadedBy NVARCHAR(40) NULL;
GO
IF COL_LENGTH(N'mehndi.Events', N'OwnerId') IS NULL
    ALTER TABLE mehndi.Events ADD OwnerId NVARCHAR(40) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Designs_UploadedBy')
    ALTER TABLE mehndi.Designs ADD CONSTRAINT FK_Designs_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES mehndi.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Events_Owner')
    ALTER TABLE mehndi.Events ADD CONSTRAINT FK_Events_Owner FOREIGN KEY (OwnerId) REFERENCES mehndi.Users(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Events_Owner')
    CREATE INDEX IX_Events_Owner ON mehndi.Events (OwnerId);
GO

/* One row per ADMIN (the SuperAdmin / studio uses StudioSettings) */
IF OBJECT_ID(N'mehndi.AdminSettings', N'U') IS NULL
CREATE TABLE mehndi.AdminSettings (
    AdminId      NVARCHAR(40)   NOT NULL CONSTRAINT PK_AdminSettings PRIMARY KEY
                 CONSTRAINT FK_AdminSettings_User REFERENCES mehndi.Users(Id) ON DELETE CASCADE,
    UpiId        NVARCHAR(100)  NOT NULL CONSTRAINT DF_AdminSettings_Upi DEFAULT (N''),
    MerchantName NVARCHAR(150)  NOT NULL CONSTRAINT DF_AdminSettings_Merchant DEFAULT (N'Mehndi Studio'),
    QrImagePath  NVARCHAR(300)  NULL,
    UpdatedAt    DATETIME2(3)   NOT NULL CONSTRAINT DF_AdminSettings_Updated DEFAULT (SYSUTCDATETIME())
);
GO

/* Anything created before ownership existed belongs to the SuperAdmin */
UPDATE mehndi.Events  SET OwnerId    = (SELECT TOP 1 Id FROM mehndi.Users WHERE Role = 'SUPERADMIN') WHERE OwnerId IS NULL;
UPDATE mehndi.Designs SET UploadedBy = (SELECT TOP 1 Id FROM mehndi.Users WHERE Role = 'SUPERADMIN') WHERE UploadedBy IS NULL;
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

/* =====================================================================
   v4: slot booking (opening hours, service durations, stations/chairs)
   - Designs.DurationMinutes      how long one item takes
   - ScheduleSettings             opening hours, slot length, number of stations, closed days
   - Orders.Slot*                 the time the booking occupies (normal bookings only)
   "Station" = a barber chair, stylist, wash bay, treatment room ...
   ===================================================================== */
IF COL_LENGTH(N'mehndi.Designs', N'DurationMinutes') IS NULL
    ALTER TABLE mehndi.Designs ADD DurationMinutes INT NOT NULL CONSTRAINT DF_Designs_Duration DEFAULT (60);
GO
IF COL_LENGTH(N'mehndi.Orders', N'SlotDate') IS NULL
    ALTER TABLE mehndi.Orders ADD SlotDate DATE NULL, SlotStartMin INT NULL, SlotMinutes INT NULL, SlotStations INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Orders_Slot')
    CREATE INDEX IX_Orders_Slot ON mehndi.Orders (SlotDate) WHERE SlotDate IS NOT NULL;
GO

IF OBJECT_ID(N'mehndi.ScheduleSettings', N'U') IS NULL
CREATE TABLE mehndi.ScheduleSettings (
    Id          INT          NOT NULL CONSTRAINT PK_ScheduleSettings PRIMARY KEY,
    OpenTime    CHAR(5)      NOT NULL CONSTRAINT DF_Sched_Open   DEFAULT ('09:00'),
    CloseTime   CHAR(5)      NOT NULL CONSTRAINT DF_Sched_Close  DEFAULT ('20:00'),
    SlotMinutes INT          NOT NULL CONSTRAINT DF_Sched_Slot   DEFAULT (30),   -- booking grid step
    Stations    INT          NOT NULL CONSTRAINT DF_Sched_Stat   DEFAULT (1),    -- how many can be served at the same time
    ClosedDays  VARCHAR(20)  NOT NULL CONSTRAINT DF_Sched_Closed DEFAULT (''),   -- weekdays closed, 0=Sun ... 6=Sat, e.g. '0,6'
    AdvanceDays INT          NOT NULL CONSTRAINT DF_Sched_Adv    DEFAULT (30),   -- how far ahead customers may book
    UpdatedAt   DATETIME2(3) NOT NULL CONSTRAINT DF_Sched_Updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_ScheduleSettings_Single CHECK (Id = 1)
);
GO
IF NOT EXISTS (SELECT 1 FROM mehndi.ScheduleSettings WHERE Id = 1)
    INSERT INTO mehndi.ScheduleSettings (Id) VALUES (1);
GO

/* =====================================================================
   v5: SuperAdmin-managed business type
   - AppSettings.ActiveIndustry   which industry profile the site uses (overrides INDUSTRY in .env)
   - Industries                   industries the SuperAdmin added (built-in ones live in code)
   - IndustryLabels               wording overrides per industry (shop name, "service", hero text ...)
   Categories are managed directly in mehndi.Categories (add / edit / reorder / delete).
   ===================================================================== */
IF OBJECT_ID(N'mehndi.AppSettings', N'U') IS NULL
CREATE TABLE mehndi.AppSettings (
    Id             INT           NOT NULL CONSTRAINT PK_AppSettings PRIMARY KEY,
    ActiveIndustry NVARCHAR(50)  NULL,
    UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_AppSettings_Updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_AppSettings_Single CHECK (Id = 1)
);
GO
IF NOT EXISTS (SELECT 1 FROM mehndi.AppSettings WHERE Id = 1)
    INSERT INTO mehndi.AppSettings (Id) VALUES (1);
GO

IF OBJECT_ID(N'mehndi.Industries', N'U') IS NULL
CREATE TABLE mehndi.Industries (
    IndustryKey NVARCHAR(50)  NOT NULL CONSTRAINT PK_Industries PRIMARY KEY,
    Name        NVARCHAR(100) NOT NULL,            -- e.g. "Tattoo studio"
    BaseKey     NVARCHAR(50)  NOT NULL,            -- built-in profile it started from (mehndi/barber/salon/carwash)
    CreatedBy   NVARCHAR(40)  NULL,
    CreatedAt   DATETIME2(3)  NOT NULL CONSTRAINT DF_Industries_Created DEFAULT (SYSUTCDATETIME())
);
GO

IF OBJECT_ID(N'mehndi.IndustryLabels', N'U') IS NULL
CREATE TABLE mehndi.IndustryLabels (
    IndustryKey NVARCHAR(50)  NOT NULL,
    LabelKey    VARCHAR(50)   NOT NULL,
    Value       NVARCHAR(MAX) NOT NULL,
    CONSTRAINT PK_IndustryLabels PRIMARY KEY (IndustryKey, LabelKey)
);
GO

/* =====================================================================
   v6: categories belong to an industry
   The site only shows the categories (and the items in them) of the ACTIVE industry.
   Switching industry swaps what is visible - nothing is deleted.
   ===================================================================== */
IF COL_LENGTH(N'mehndi.Categories', N'IndustryKey') IS NULL
    ALTER TABLE mehndi.Categories ADD IndustryKey NVARCHAR(50) NULL;
GO
/* the built-in starter categories belong to their industry */
UPDATE mehndi.Categories SET IndustryKey = 'mehndi'  WHERE IndustryKey IS NULL AND Id IN ('arabic','indian','pakistani','moroccan','indo-arabic','minimal-modern','bridal');
UPDATE mehndi.Categories SET IndustryKey = 'barber'  WHERE IndustryKey IS NULL AND Id IN ('haircuts','beard-shave','kids-cuts','hair-colour','facials-skin','head-massage','grooming-packages');
UPDATE mehndi.Categories SET IndustryKey = 'salon'   WHERE IndustryKey IS NULL AND Id IN ('hair-styling','colour','hair-treatments','facials','nails','waxing','makeup-bridal');
UPDATE mehndi.Categories SET IndustryKey = 'carwash' WHERE IndustryKey IS NULL AND Id IN ('exterior-wash','interior-cleaning','full-detailing','polish-wax','paint-protection','engine-underbody','add-ons');
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Categories_Industry')
    CREATE INDEX IX_Categories_Industry ON mehndi.Categories (IndustryKey, SortOrder);
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
