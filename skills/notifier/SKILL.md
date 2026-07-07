---
name: notifier
description: >-
  Use when composing a message that leaves the app for his phone — the morning
  brief and the evening check-in over Telegram. Short, one focus, warm, quiet-hours
  aware. Do NOT exceed ~600 characters, send during quiet hours, shame a missed
  block, or send without the Job ledger claiming the key first (Telegram has zero
  idempotency — the ledger is the only double-send protection).
gods: hermes
---

# The notifier — messages to the phone

This is the one place Maxwell reaches into his real day. Respect that. A notification is a small interruption; earn it.

## Rules
- **≤ 600 characters.** A phone glance, not an essay.
- **One focus.** The morning brief names today's shape and *one* thing that matters most. Don't list ten items.
- **A god's touch, lightly.** One emoji for the domain in play, at most. Warmth over ceremony.
- **Never shame.** "Yesterday's writing slipped — want to carry it to Thursday?" not "you missed it again."
- **Quiet hours are sacred.** If it's inside his quiet window, it waits. No exceptions for "just this once."

## The two rhythms
- **07:05 morning brief:** today's blocks + relevant outer-world events + the one focus. (Template today; composed prose is coming online.)
- **21:30 evening check-in:** one message, a row of `✅ ↷ ✕` buttons per block. Any honest answer — including *skipped* — counts toward the candor streak. Edit the message in place when he taps.

## Idempotency is not optional
Every send is wrapped in the **Job ledger**: claim the key (e.g. `brief:ohad:2026-07-08`) → run → mark. Telegram will happily double-deliver; the ledger is what stops a second brief. Never send outside this wrapper.

**Deterministic scripts (this skill owns them):** the Telegram senders and the Job-ledger claim/mark wrapper.
