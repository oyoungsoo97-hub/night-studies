# Night Studies · After Hours

[English](README.md) · [한국어](README.ko.md) · [Deutsch](README.de.md)

[Open Night Studies in English](https://oyoungsoo97-hub.github.io/night-studies/?lang=en)

Two camera stages and three studios for posters, Foley and photography. The language menu switches the interface while you work. Your titles, captions and files keep their original names.

| Stage or studio | Make something |
| --- | --- |
| [Astral Atelier](https://oyoungsoo97-hub.github.io/night-studies/spell-stage/?lang=en) | Gather a cloud of silver particles, carry it with a hand, stretch it between your palms and release it. Choose the wand to send Cinderlash into Glass Ward. |
| [Portrait Loom](https://oyoungsoo97-hub.github.io/night-studies/portrait-stage/?lang=en) | Build a textured 3D character from an uploaded photo. Orbit the figure, light the face, perform with your camera and export the current pose as a GLB model. |
| [Last Train](https://oyoungsoo97-hub.github.io/night-studies/last-train/?edition=house&lang=en) | Build a film poster with your photo, an ink treatment, a paper tear and a frame from the train sequence. Export a PNG. |
| [Foley Club](https://oyoungsoo97-hub.github.io/night-studies/foley-club/?edition=house&lang=en) | Score two takes against a film. Adjust cue timing, level and stereo position, then export a 48 kHz stereo WAV. Your own playable MP4 or WebM clip can be up to 60 seconds and 12 MiB. |
| [Light Table](https://oyoungsoo97-hub.github.io/night-studies/light-table/?edition=house&lang=en) | Add up to five photos, arrange three crops and captions, and export your layout as PNG or JPEG. |

[![The Astral Atelier and Portrait Loom camera stages](media/night-studies.webp)](https://oyoungsoo97-hub.github.io/night-studies/?lang=en)

### Performing and saving

The Winter study combines six TV10 stills with walking footage. Use **Front**, **Profile** and **Back** to inspect the fit. A direct rear-view recording informed the hair and garment construction. The central rear textures and the hand outside the crop are modeled. **Fit rear photo** lets you align your own crown-to-nape image locally and save it with the project.

Portrait Loom opens JPEG, PNG, WebP, GIF, BMP and AVIF. HEIC requires a browser with a compatible decoder. Animated GIFs use their first frame.

Choose a person in a group shot or mark the eyes and mouth of a drawing. Drag on the 3D figure to orbit, or use the rotation slider. Change the light to see the depth of the nose, the chin and the fingers. The visible surfaces use the photograph. The shape and materials of the hidden sides are estimated from that view. **Export 3D model** saves the current pose and its textures as a GLB. A **Save project** file keeps the editable performance.

Both stages export PNGs and can record up to 12 seconds in browsers that support video recording. Astral Atelier records the visible backdrop. Enable spell sounds before recording to include the synthesized stereo mix. Camera tracking uses video only.

**Save project** keeps your work in this browser’s project library. To move it to another device, choose **Manage → Export file**, then **Import file** in the other browser. A `.nightstudy` file includes the media you imported and the editable settings. Camera frames, imported photos and face, hand and body landmarks are processed on your device.

### Run locally

Unzip the distribution and open **Start.command** on macOS, or run `python3 run.py` in the extracted folder with Python 3. On Windows, use `py -3 run.py`. The default address is `http://127.0.0.1:17473/`. Use the same address and browser to return to your saved projects. Press Ctrl+C in the terminal to stop. The tracking models and fonts are included in the ZIP.

[Artwork, models and licenses](CREDITS.md)
