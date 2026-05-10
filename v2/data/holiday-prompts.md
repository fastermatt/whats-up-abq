# Holiday Hero Image Prompts — Midjourney

Works in **midjourney.com** (the web app) AND Discord — same prompt syntax.

## Visual style — locked 2026-05-09

After the first batch (Mother's Day), the look that works best is **linocut / hand-drawn screen-print** in the brand palette — NOT photo-realism. Photos clash with the photo cards on the rest of the site; an illustrated style sets the holiday rail apart visually and is forgiving of MJ's rough edges (no faces to mess up, no fingers to count).

Use this style frame on every prompt:

> linocut hand-drawn screen-print imagery in **terra orange, deep teal, cream beige, and white**, textured ink with rough overprint feel, no text or words

Then add the holiday subject. The shorter and more verb-driven the prompt, the better — MJ web rewards clarity over a wall of adjectives.

## Brand palette

`#fbf7f1` cream · `#9a442d` terra · `#4f6249` sage · `#006a62` turquoise

## Constraints

- **NO TEXT EVER.** MJ can't spell. Every prompt ends with `--no text, words, letters, typography`. If MJ slips text in (especially common on signs, banners, books), regenerate or pick a different variant.
- **Composition leaves room for text overlay** on either side or center (banner is 21:9-ish).
- The linocut style makes faces safe at a stylized distance (see the shipped Mother's Day image — woman + child rendered in screen-print).

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
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, happy mother's day celebration, mother and child embracing surrounded by wildflowers --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Father's Day · `fathers-day-bg.avif` + `fathers-day-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, happy father's day celebration, father and child silhouettes with mountain horizon --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Cinco de Mayo · `cinco-de-mayo-bg.avif` + `cinco-de-mayo-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, cinco de mayo celebration, papel picado banners and adobe wall under bright sun --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Valentine's Day · `valentines-day-bg.avif` + `valentines-day-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, valentine's day celebration, two hearts intertwined with desert blooms --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### St. Patrick's Day · `st-patricks-day-bg.avif` + `st-patricks-day-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, st patrick's day celebration, clovers and pint glass with celtic knot border --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Memorial Day · `memorial-day-bg.avif` + `memorial-day-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, memorial day remembrance, folded flag on cottonwood bench at dawn --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Juneteenth · `juneteenth-bg.avif` + `juneteenth-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, juneteenth celebration, raised hands and freedom drums with sunburst --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### 4th of July · `fourth-of-july-bg.avif` + `fourth-of-july-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, fourth of july celebration, fireworks above sandia mountain silhouette --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Labor Day · `labor-day-bg.avif` + `labor-day-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, labor day end of summer, picnic basket and string lights over a long table --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Balloon Fiesta · `balloon-fiesta-bg.avif` + `balloon-fiesta-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, albuquerque balloon fiesta, single hot air balloon ascending over mesa at dawn --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Halloween · `halloween-bg.avif` + `halloween-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, halloween night, glowing jack-o-lantern on adobe doorstep with crescent moon --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Día de los Muertos · `dia-de-los-muertos-bg.avif` + `dia-de-los-muertos-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, día de los muertos altar, marigolds and candles around a sugar skull --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Thanksgiving · `thanksgiving-bg.avif` + `thanksgiving-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, thanksgiving feast, harvest table with squash, corn, and red chile ristras --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### Christmas · `christmas-bg.avif` + `christmas-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, christmas in old town albuquerque, luminarias along an adobe wall with snow --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6

### New Year's Eve · `new-years-eve-bg.avif` + `new-years-eve-hero.avif`
> linocut hand-drawn screen-print imagery in terra orange, deep teal, cream beige, and white, textured ink with rough overprint feel, new year's eve celebration, sparkling coupe glasses raised against city lights --no text, words, letters, typography, signage, captions, watermark, lettering, writing, characters, signs, numbers --ar 21:9 --style raw --v 6
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
| Mother's Day | ✅ | ✅ | — |
| Father's Day | ✅ | ✅ | — |
| Cinco de Mayo | ⏳ | ⏳ | ⏳ |
| Valentine's Day | ⏳ | ⏳ | ⏳ |
| St. Patrick's Day | ⏳ | ⏳ | ⏳ |
| Memorial Day | ✅ | ✅ | — |
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
