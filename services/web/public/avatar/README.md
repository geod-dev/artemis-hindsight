# Chat avatar

The chat bot's shape lives in `definition.json`. The app fetches it at runtime (`/avatar/definition.json`),
checks it with `validateAvatar` from `open-bot-avatar`, and mounts the avatar with it.

## Files

- `definition.json`: the avatar. `body.path` is the silhouette, `eyes` places the eye pair.
- This README.

The colors are not in this file. They live in `src/components/avatar/bot-avatar.tsx`:
the body is Google blue (`#4285F4`), and the eyes use `var(--background)` so they read as cut-outs.

## The contract

From [open-bot-avatar](https://github.com/DominikScholz/open-bot-avatar/blob/main/docs/avatar-contract.md):

- `version`: `1`.
- `id`, `name`: strings. This avatar is `avatar` / `Avatar`.
- `body.path`: one SVG path in a `0 0 100 100` box. Nonzero fill rule; holes wind opposite to their outline.
- `eyes`: `x`, `y` (centre of the eye pair), `spacing` (centre-to-centre distance), `scale` (1 = normal size).

## Regenerating the body

The body is a circle whose radius wobbles with a cosine. `scripts/avatar-body.mjs` writes that path into
`definition.json`:

```sh
cd services/web
node scripts/avatar-body.mjs                                  # current defaults
node scripts/avatar-body.mjs --lobes 7 --amp 1.5 --base 36 --points 360
```

Options:

| Option | Default | Effect |
| --- | --- | --- |
| `--lobes` | `7` | Number of bumps around the rim. Fewer means wider, longer waves. |
| `--amp` | `1.5` | How far the rim moves in and out, in viewBox units. Lower means less spiky. |
| `--base` | `36` | Average radius. The shape spans `base ± amp` around the centre. |
| `--points` | `360` | Points on the outline. More points give a smoother curve. |
| `--cx`, `--cy` | `50` | Centre of the shape. |

The script keeps `id`, `name`, `version` and `eyes`, and only writes the file if the new path passes
`validateAvatar`. If validation fails it exits with an error and leaves the file unchanged.

To move the eyes, edit `eyes` by hand. The body and the eyes are independent.

## Previewing

After regenerating, reload the app and look at the avatar in a new chat and in a conversation. The
definition is fetched once per page load, so a hard reload is needed to see a change.
