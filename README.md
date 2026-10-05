# Job Fast Capture - Feed Auto v0.7.0

Fixes LinkedIn `/feed/` Auto Scan.

## Main fix

The old build tried to guess a scrollRoot. On LinkedIn this can point at an element whose `scrollHeight` equals `clientHeight`, so nothing moves.

v0.7.0 no longer depends on a guessed feed scroll container. It:

1. Finds current feed cards using `[role="listitem"][componentkey^="update-card-focus"]`.
2. Scans the visible cards.
3. Saves new jobs immediately.
4. Calls `scrollIntoView()` on the last visible feed card.
5. Nudges the document downward to trigger lazy loading.
6. Re-queries LinkedIn's virtualized DOM and continues until the visible post set stops changing.

It keeps the v0.6 features:
- `postedBy`
- `posterProfileUrl`
- `dmContact`
- contract/email/contact/image extraction

Popup must show:

`v0.7.0 • Feed Auto Scroll Fixed`

After installing, disable/remove the older extension, Load unpacked this folder, then Ctrl+Shift+R LinkedIn Feed.
