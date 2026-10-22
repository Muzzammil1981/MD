USE [MaintenenceModule];
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

/* Any category you created yourself earlier (not a built-in starter) goes to the industry that is active now.
   (The server also does this automatically on start.) */
UPDATE mehndi.Categories
   SET IndustryKey = ISNULL((SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1), 'mehndi')
 WHERE IndustryKey IS NULL;
GO
