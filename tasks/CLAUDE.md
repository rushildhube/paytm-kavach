# tasks/

Working files for planning and self-correction.

## What belongs here

- `todo.md` — the current plan as checkable items, progress marks, and a review section when work is finished.
- `lessons.md` — patterns learned from corrections, written as rules that prevent the same mistake (not created yet).

## What is here now

- `todo.md` — two finished plans, newest first, each with a review:
  1. "Verify the rules table and watch for law changes" (branch `verify/rules`): all 10 rules verified, ladder corrected to escalate on day 22, law watcher added. Lists what is still open (court judgments read via reports, RBI draft PDF unread, final RBI directions expected 30 November 2026).
  2. "End-to-end demo path (₹826 flow)": the first build. Parts of its review are now out of date: it mentions Claude drafting, a 15-day placeholder deadline and cached fallbacks in `demo/`. Drafting is Sarvam, the deadline is day 22, and no cached fallbacks exist. The newer plan above supersedes it.

Coordination between branches and agents now happens in GitHub issues (pinned rulebook #8, dev guide #9, pitfalls #10, unowned work #11). Use `todo.md` for the plan of the work in hand, not as the shared backlog.

## Rules for this folder

- Write the plan to `todo.md` before non-trivial work and mark items off as they are completed. Put the newest plan at the top.
- Update `lessons.md` after any correction from the user (create it on the first one); review it at the start of a session.
- Record open decisions here until settled; settled ones move to the root `CLAUDE.md`.
