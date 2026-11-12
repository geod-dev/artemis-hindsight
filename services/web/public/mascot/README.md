# Avatar body

The avatar's silhouette is one SVG path, stored as `body.path` in `definition.json`. `scripts/avatar-body.mjs` generates it.

The body is a circle whose radius wobbles with a cosine. The script writes that path into `definition.json`:

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

The script keeps the other fields of `definition.json` and only writes the file if the new path passes
`validateAvatar`. If validation fails it exits with an error and leaves the file unchanged.
