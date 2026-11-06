# saatvik538.github.io

Personal site of **Saatvik Kesarwani**, ECE @ UT Austin, Robotics Honors.

The whole site is one circuit board: scrolling follows a copper signal bus from the main processor,
through six project modules and five experience chips, to the UT Austin core.

Plain HTML/CSS/JS with [three.js](https://threejs.org) (vendored in `assets/vendor`), no build step.

## Adding photos

Drop JPGs into `assets/photos/` with these names and they appear on the experience timeline automatically
(16:10 crop, ~1200px wide is plenty). Missing photos are simply hidden.

`orangewood.jpg` · `dartmouth.jpg` · `obscurity-labs.jpg` · `texas-aerial-robotics.jpg` · `nesteye.jpg`

The About portrait is `headshot.jpg`.

## Run locally

```bash
python3 -m http.server 8000
```
