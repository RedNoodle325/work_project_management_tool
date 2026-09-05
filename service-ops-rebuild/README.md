# Service Operations Platform Scaffold

Fresh rebuild scaffold for a global service operations management system. The existing project-management tool is treated as workflow reference only.

## V0 focus

- Global command center
- Technician roster, capacity and assignment model
- Sites and assets
- Work orders separated from service visits
- Site-level financial ledger
- Actual, committed and forecast cost tracking
- Cost categorization across labor, travel, parts, freight, vendors and other service spend
- Multi-currency-ready schema

## Design

The visual foundation uses the supplied Munters Design System token values, including Munters blue `#5EA4DE`, dark neutral `#313131`, subtle surface `#F4F5F6`, semantic status colors and restrained card/table styling.

## Run locally

```bash
npm install
npm run dev
```

## Database

Start with `database/001_initial.sql` in PostgreSQL/Supabase. Unlike the previous application, schema changes should be managed through versioned migrations rather than runtime `ALTER TABLE` logic.

## Suggested next slices

1. Technician directory + regional capacity
2. Work order + service visit creation
3. Dispatch board / weekly schedule
4. Site financial detail with cost drill-down
5. Site + asset detail
6. Parts and logistics
7. Imports/integrations from ERP, Astea/service systems, expense systems and payroll/timekeeping
