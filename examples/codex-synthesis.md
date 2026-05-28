# Review Synthesis Template

When Codex receives multiple `cc_review` results (e.g., a plan review and a
diff review for the same change), synthesize them before acting. Use this
template to produce a decision record.

---

## Review Synthesis: [change description]

Date: [YYYY-MM-DD]

### Reviews Received

| # | Reviewer | Task | Provider | Verdict Summary |
| --- | --- | --- | --- | --- |
| 1 | cc_review | review_plan | anthropic | ... |
| 2 | cc_review | review_diff | anthropic | ... |

### Findings by Severity

#### Blockers (must fix before proceeding)

| # | Finding | Source | Action | Rationale |
| --- | --- | --- | --- | --- |
| 1 | [description] | Review #N | ACCEPT / REJECT / DEFER | [why] |

#### Important (should fix, but not blocking)

| # | Finding | Source | Action | Rationale |
| --- | --- | --- | --- | --- |
| 1 | [description] | Review #N | ACCEPT / REJECT / DEFER | [why] |

#### Nice-to-Have (consider for future work)

| # | Finding | Source | Action | Rationale |
| --- | --- | --- | --- | --- |
| 1 | [description] | Review #N | ACCEPT / REJECT / DEFER | [why] |

### Conflict Resolution

List any findings where two reviews disagree, and the resolution:

| Conflict | Review #A says | Review #B says | Resolution |
| --- | --- | --- | --- |

### Deferred Items

Items deferred for follow-up (with tracking reference):

| Finding | Reason deferred | Follow-up plan |
| --- | --- | --- |

### Overall Assessment

[One paragraph summarizing the review outcome and the plan forward.]

### Action Items

- [ ] [action 1]
- [ ] [action 2]
