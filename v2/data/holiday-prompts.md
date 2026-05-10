# Holiday Hero Image Prompts — Midjourney

Works in **midjourney.com** (the web app) AND Discord — same prompt syntax. Tuned to ABQ Unplugged's brand:

- **Cream `#fbf7f1` body**, **terra `#9a442d` accent**, **sage `#4f6249`**, **turquoise `#006a62`**
- **Editorial photography aesthetic** (NOT illustration, NOT digital art). Looks like a magazine cover.
- **Albuquerque-grounded** — desert light, adobe walls, Sandia silhouettes, southwest flora — but never cliché-southwestern.
- **Composition leaves room for text overlay** on either side or center (banner is 21:9-ish).
- **No people's faces close up**. Hands, silhouettes, or environment shots only — keeps reuse safe and dodges AI-face slop.
- **NO TEXT EVER.** MJ can't spell. Every prompt below ends with an aggressive `--no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers` block. Don't remove it. If you DO see text in the output (especially common on signs, banners, books, posters), regenerate with `--no` even more aggressive.

For each holiday you'll generate **TWO** images:
- `bgImage` (banner): aspect `--ar 21:9`, ~2400×1029. Goes behind the top sliver banner.
- `heroImage` (rail thumb): aspect `--ar 16:10`, ~1200×750. Sits next to the section title on the homepage.

---

## Workflow

1. Paste the prompt into Midjourney. Generate 4 variants. Upscale the best one twice (V→U).
2. Crop tightly to the target ratio (don't trust MJ's `--ar` exactly).
3. Export as **AVIF** (or WebP) at `~75 KB` for banners, `~30 KB` for rail thumbs. Use `squoosh.app` for compression.
4. Upload to Supabase Storage:
   ```
   bucket:    event-photos
   folder:    holiday-images/
   filename:  <key>-bg.avif    (banner)
              <key>-hero.avif  (rail thumb)
              <key>-og.avif    (1200×630 OG)
   ```
   Where `<key>` matches the holiday's `key` field in `data/holidays.ts`
   (e.g., `mothers-day-bg.avif`).
5. Get the public URL from the Supabase Storage UI (or use `supabase.storage.from('event-photos').getPublicUrl('holiday-images/mothers-day-bg.avif')`).
6. Paste URLs into `data/holidays.ts`:
   ```ts
   {
     key: 'mothers-day',
     ...
     bgImage:   'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/mothers-day-bg.avif',
     heroImage: 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/holiday-images/mothers-day-hero.avif',
   },
   ```
7. Commit. Banner + rail will pick the image up automatically on next deploy.

---

## Prompts

### Mother's Day · `mothers-day-bg.avif` + `mothers-day-hero.avif`
> Editorial photograph of a hand placing a small bouquet of native New Mexico wildflowers (Indian paintbrush, chocolate flower, blue flax) on a worn cream linen tablecloth in soft morning light, terracotta clay vase to the side, blurred adobe wall in background warm peach tone, shallow depth of field, fine grain, magazine cover aesthetic, color palette warm cream and terra and dusty sage, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Father's Day · `fathers-day-bg.avif` + `fathers-day-hero.avif`
> Editorial photograph of an aged leather mitt and a baseball resting on a weathered cedar picnic table at golden hour, a pint glass of amber craft beer beside them, blurred Sandia mountain silhouette in distant background, warm cream and terra tones, shallow depth of field, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Cinco de Mayo · `cinco-de-mayo-bg.avif` + `cinco-de-mayo-hero.avif`
> Editorial photograph of strands of colorful papel picado fluttering against a deep adobe wall under bright New Mexico sun, sharp shadow lines on cream stucco, single string of warm festival lights, color palette terra red and turquoise and warm cream, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Valentine's Day · `valentines-day-bg.avif` + `valentines-day-hero.avif`
> Editorial photograph of two small ceramic mugs of mulled wine on a sun-warmed adobe sill, single dried rose with terracotta petals beside them, evening Sandia sunset glow on the wall, warm terra and cream and dusty pink palette, shallow depth of field, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### St. Patrick's Day · `st-patricks-day-bg.avif` + `st-patricks-day-hero.avif`
> Editorial photograph of a pint of dark stout on a worn wooden bar, single sprig of green clover beside it, warm string lights softly blurred behind, adobe wall textures, palette of dusty sage green and warm cream and terra wood tones, shallow depth of field, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Memorial Day · `memorial-day-bg.avif` + `memorial-day-hero.avif`
> Editorial photograph of a folded American flag resting on a sun-bleached wooden bench in a quiet New Mexico cemetery at dawn, soft golden hour light, distant cottonwoods and Sandia mountain silhouette, palette of muted cream sage and dusty terra, contemplative quiet mood, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Juneteenth · `juneteenth-bg.avif` + `juneteenth-hero.avif`
> Editorial photograph of strung warm festival lights crossing a wide community plaza at sunset, adobe walls glowing terra and gold, percussion drums softly visible in the foreground out of focus, palette of warm cream terra and rich red, celebratory uplifting mood, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### 4th of July · `fourth-of-july-bg.avif` + `fourth-of-july-hero.avif`
> Editorial photograph of small fireworks bursting above a darkened Sandia mountain ridgeline at dusk, foreground silhouette of cottonwoods and adobe rooftops, warm cream and terra and deep navy palette, single sparkler trail of warm light, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Labor Day · `labor-day-bg.avif` + `labor-day-hero.avif`
> Editorial photograph of a worn enamel cooler open on a cottonwood-shaded picnic table in the South Valley, ice and craft beer cans inside, warm late summer afternoon light, blurred green chile field in background, palette of cream sage and warm terra, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Balloon Fiesta · `balloon-fiesta-bg.avif` + `balloon-fiesta-hero.avif`
> Editorial photograph of a single hot air balloon ascending into a cool dawn sky over the Albuquerque West Mesa, warm balloon glowing terra and gold against pre-dawn lavender sky, distant Sandia mountains catching first light, foreground sage brush, palette warm cream gold terra and soft lavender, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Halloween · `halloween-bg.avif` + `halloween-hero.avif`
> Editorial photograph of a single carved jack-o-lantern on a worn adobe doorstep, warm candlelight glow, single dried sunflower beside it, deep autumn shadows, palette of warm terra and burnt orange and deep cream, slightly eerie but cozy mood, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Día de los Muertos · `dia-de-los-muertos-bg.avif` + `dia-de-los-muertos-hero.avif`
> Editorial photograph of a small ofrenda altar at dusk, marigolds and warm candle flames, framed sepia photograph blurred in background, terracotta clay vessels, palette of warm marigold orange and terra and cream and deep cobalt accents, reverent celebratory mood, magazine cover aesthetic, fine grain, respectful tone, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Thanksgiving · `thanksgiving-bg.avif` + `thanksgiving-hero.avif`
> Editorial photograph of a long worn wooden farm table set with terracotta plates and ceramic bowls of roasted squash and red chile, single warm candle glowing in the center, blurred adobe kitchen behind, palette of warm cream terra and burnt sienna, slow late autumn afternoon light, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### Christmas · `christmas-bg.avif` + `christmas-hero.avif`
> Editorial photograph of warm luminarias glowing along a snow-dusted adobe wall at blue hour in Old Town Albuquerque, soft snowfall, single juniper branch with red berries in the foreground, palette of warm cream gold terra and deep cobalt blue, magical reverent mood, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6

### New Year's Eve · `new-years-eve-bg.avif` + `new-years-eve-hero.avif`
> Editorial photograph of a single coupe glass of sparkling wine catching warm light on a high adobe rooftop bar, blurred string lights crossing toward the Sandia mountain silhouette at dusk, palette of warm gold cream terra and deep midnight blue, celebratory anticipatory mood, magazine cover aesthetic, fine grain, --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers, books, posters, banners with text --ar 21:9 --style raw --v 6
---

## Tips for prompt tweaking

- If MJ keeps inserting text/letters: add `--no text, no typography, no signage`
- If MJ over-stylizes: keep `--style raw --v 6` (or whatever current MJ raw mode flag is)
- If color looks wrong: add `, color graded warm cream and terra` toward the end
- Want more abstract / less photo: swap "Editorial photograph" → "Soft impressionist painting in oil" + change `--style raw` to `--style scenic`. But test ONE first — illustrations clash with the rest of the site's photo cards.
- For the OG share image (1200×630), re-run with `--ar 1200:630` and crop tighter — the OG composition needs the subject more centered since it gets cropped on different platforms.

---

## Status — current state of holiday images

| Holiday | bgImage | heroImage | ogImage |
|---|---|---|---|
| Mother's Day | ⏳ | ⏳ | ⏳ |
| Father's Day | ⏳ | ⏳ | ⏳ |
| Cinco de Mayo | ⏳ | ⏳ | ⏳ |
| Valentine's Day | ⏳ | ⏳ | ⏳ |
| St. Patrick's Day | ⏳ | ⏳ | ⏳ |
| Memorial Day | ⏳ | ⏳ | ⏳ |
| Juneteenth | ⏳ | ⏳ | ⏳ |
| 4th of July | ⏳ | ⏳ | ⏳ |
| Labor Day | ⏳ | ⏳ | ⏳ |
| Balloon Fiesta | ⏳ | ⏳ | ⏳ |
| Halloween | ⏳ | ⏳ | ⏳ |
| Día de los Muertos | ⏳ | ⏳ | ⏳ |
| Thanksgiving | ⏳ | ⏳ | ⏳ |
| Christmas | ⏳ | ⏳ | ⏳ |
| New Year's Eve | ⏳ | ⏳ | ⏳ |

Update to ✅ as you upload each. The site renders gracefully with no image (terra solid banner, text-only rail header), so you can do them gradually — start with whichever holiday is coming up next.
