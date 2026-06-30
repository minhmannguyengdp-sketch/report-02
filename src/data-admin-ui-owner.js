// Data/Admin UI ownership module.
// UI-only ownership boundary for Data hub and Admin shell contracts.
//
// Data hub render logic currently lives in data-hub-shell.js.
// Admin sync logic stays in supabase-sync.js and must remain imported separately.
// Do not rename #syncBtn, #syncState, #dbInfo, or #adminStats without a sync audit.

import './data-hub-shell.js?v=ui-boundary-1';
