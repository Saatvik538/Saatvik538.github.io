# saatvik538.github.io

Personal site of **Saatvik Kesarwani**, ECE @ UT Austin, Robotics Honors. I love to build and explore.

**Flight SK-26:** a starfield over a dotted, rotating Earth. The plane flies an itinerary route as you scroll,
landing at each project and experience (each one a boarding pass), then the interactive globe shows
everywhere I've traveled, with arcs from Austin.

Plain HTML/CSS/JS, no build step. Map data from `world-atlas` / `us-atlas`, rendered with `d3-geo`
(all vendored in `assets/`).

## Editing travel

Open `app.js`; the lists at the top (`BEEN`, `NEXT`, `COUNTRIES`, `STATES`) drive the globe, the stamps and the stats.

## Adding photos

Drop JPGs into `assets/photos/` with these names and they appear on the experience boarding passes (16:9):
`nesteye.jpg` · `texas-aerial-robotics.jpg` · `dartmouth.jpg` · `obscurity-labs.jpg` · `orangewood.jpg`

## Run locally

```bash
python3 -m http.server 8000
```
