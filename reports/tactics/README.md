# King bot tactical update — 6 November 2026

Baseline: `a7c975af198234467250a08061cd345e5ef10be9`. Rules, UI, contract selection and hidden-hand access boundaries are unchanged.

## Behavior

- Male/queen avoidance: when following the first lead of a suit, cash a high non-penalty winner if that suit’s penalty cards are in the bot’s own hand or already publicly played. Visible penalties and known remaining voids with possible penalty discards suppress this bonus; ordinary estimated penalty risk is still charged.
- Last two: spend high winners during all eleven free tricks, retaining low escapes for tricks twelve and thirteen.
- Hearts: after hearts break, favor a low heart lead when opponents can follow and the bot is unlikely to take it. The engine still blocks an unbroken heart lead unless only hearts remain.
- Last-seat equivalent winners: if every legal card wins, belongs to the same suit, and has the same immediate penalty, spend the highest. This applies to heuristic and Monte Carlo decisions; trump games are excluded.

Easy retains its intentional random errors. Hard search still uses public-information determinizations; a proven equivalent-winner choice needs no rollout.

## Validation

Ten focused tactical tests cover the supplied examples, completed Monte Carlo samples, first-lead boundaries, known voids, forced penalties, the last-two cutoff, legal hearts, information isolation and mutation safety. A further test verifies the paired report on identical policies. Existing bot/rule checks passed locally; the full server/UI suite runs in GitHub Actions.

## Measurement

Development: 200 paired matches, seeds 62001–62200. The initial broad ownership bonus changed mean score from 348.15 to 340.50 (−7.65). Inspection showed that it also rewarded opening aces and repeated suit leads. Restricting it to a first-follow tactic yielded 356.20 (+8.05; bootstrap 95% interval −5.90 to +22.05). This is development evidence, not an independent strength claim.

Frozen-policy holdout: 200 paired matches, seeds 63001–63200; 4,000 rounds per version, against the unchanged legacy opponents. Candidate seats rotate. Bootstrap intervals resample whole paired matches. Higher score is better.

| Metric | Previous medium | Updated medium |
|---|---:|---:|
| Mean match score | 378.50 | 379.15 |
| Mean penalty per match | 966.00 | 965.35 |
| First place share (ties split) | 53.75% | 54.25% |
| Illegal moves | 0 | 0 |

Paired score change: +0.65; 95% interval [-16.30, +16.55]. This does not establish an overall strength improvement. Several requested tactics already partly existed, and the added first-follow ownership situation is conditional; targeted correctness is established, aggregate gain is not.

| Contract | Mean change per round | Paired 95% interval |
|---|---:|---|
| el | +0.000 | [+0.000, +0.000] |
| kupa | -0.675 | [-2.325, +0.975] |
| kiz | +1.000 | [-1.250, +3.250] |
| erkek | +0.000 | [-0.600, +0.900] |
| rifki | +0.000 | [+0.000, +0.000] |
| son | +0.000 | [-8.100, +7.650] |
| koz | +0.000 | [+0.000, +0.000] |

Updated medium local decision p95: 0.205 ms. This is not a mobile/production capacity benchmark. No human trials or held-out hard-versus-medium tournament were performed for this update.

## Reproduce

```sh
git worktree add /tmp/king-tactics-baseline a7c975af198234467250a08061cd345e5ef10be9
node scripts/bot-tactics-validation.js /tmp/king-tactics-baseline reports/tactics/recheck.json 63001 200
npm test
```

Raw paired reports: `development.json` and `holdout.json`. `winRate` in those reports means score >= 0; it is not the first-place rate.
