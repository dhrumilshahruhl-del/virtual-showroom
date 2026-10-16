# Impact Claims Approval Register

All claims below are **NOT APPROVED** for public display. The feature flag in `src/config.js` defaults to `false`; the implementation remains available. Re-enable only after every displayed value and wording has an approved source/status and RUHL authorizes changing that flag.

| Claim | Current UI wording | Source required | Status type | Scope | Approver | Approved wording | Approved? |
|---|---|---|---|---|---|---|---|
| 74,780 CFM | Before 74,780 CFM | Approved baseline airflow calculation/report and measurement conditions | Unknown | Ventilation retrofit baseline | Project engineer + RUHL | Pending | No |
| 21,480 CFM | After 21,480 CFM | Approved proposed/installed airflow calculation/report and conditions | Unknown | Ventilation retrofit case | Project engineer + RUHL | Pending | No |
| 53,300 CFM less | 53,300 CFM less | Approved source for both operands and comparison scope; arithmetic alone is not independent evidence | Unknown | Difference between displayed airflow cases | Project engineer + RUHL | Pending | No |
| 284% negative | 284% negative | Approved pressure definition, baseline, calculation, and technical review | Unknown | Building pressure | Project engineer + RUHL | Pending | No |
| Balanced / slight positive | Balanced / slight positive | Approved pressure criteria and operating/design conditions | Unknown | Proposed pressure condition | Project engineer + RUHL | Pending | No |
| ~72% heat recovery | ~72% heat-recovery effectiveness | Approved equipment/model data and defined rating conditions | Unknown | Energy recovery | Project engineer + RUHL | Pending | No |
| 26% | 26% less ventilation energy | Approved energy model/calculation and baseline | Unknown | Ventilation energy | Project engineer + RUHL | Pending | No |
| 11.9M kBtu/year | 11.9M kBtu/year ventilation energy saved | Approved annual energy calculation, assumptions, and period | Unknown | Whole ventilation retrofit | Project engineer + RUHL | Pending | No |
| 664 tCO2e/year | 664 tCO2e/year avoided annually | Approved emissions calculation, period, and emission factors | Unknown | Whole ventilation retrofit | Project engineer + RUHL | Pending | No |

For each row, record measured/modeled/projected/estimated status, calculation version/date, assumptions, scope, approver, and final approved public wording before setting `SHOW_APPROVED_IMPACT_CLAIMS` to `true`.
