# GREETING CARD LOCK STATE
## Milestone: Interior Spread Typography Pass
## Date: 2026-01-30

---

## INTERIOR SPREAD - LEFT PAGE (Letter)

### Salutation (Dear [Name],)
```css
.gc-greeting-salutation {
  font-family: var(--gc-font-title);
  font-size: 48px;                    /* -2 from body size (50px) */
  font-weight: 400;
  color: #1a3a6b;
  margin: 0 0 6px 0;
  line-height: 1.4;
  letter-spacing: 1px;
  text-align: left;
  /* NO text-shadow - lighter appearance */
}
```

### Occasion Line (Happy Birthday!)
```css
.gc-greeting-occasion {
  font-family: var(--gc-font-handwritten);
  font-size: 50px;                    /* var(--gc-letter-body-size) */
  font-weight: 400;
  color: #1a3a6b;
  line-height: 1.4;
  margin: 0 0 6px 0;
  text-align: center;                 /* CENTERED */
  text-shadow: 0 0 0.5px #1a3a6b;
}
```

### Message Body
```css
.gc-greeting-message {
  font-family: var(--gc-font-handwritten);
  font-size: 50px;                    /* var(--gc-letter-body-size) */
  font-weight: 400;
  color: #1a3a6b;
  line-height: 1.2;                   /* Tight line spacing */
  margin: 0 0 12px 0;
  text-align: left;                   /* LEFT ALIGNED */
  overflow: hidden;
  flex: 1;
  min-height: 0;
  max-height: calc(100% - 80px);      /* Room for signature */
  text-shadow: 0 0 0.5px #1a3a6b;
}

.gc-greeting-message p {
  margin: 0 0 8px 0;                  /* Tight paragraph spacing */
}

.gc-greeting-message p:first-child {
  text-indent: 0;                     /* NO indent on first paragraph */
}
```

### Signature
```css
.gc-signature {
  /* Positioned bottom-right, first name only, Title Case */
}
```

---

## INTERIOR SPREAD - RIGHT PAGE (Poem)

### Poem Text
```css
.gc-poem {
  font-family: var(--gc-font-body);
  font-size: 36px;
  font-style: italic;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  color: var(--gc-text-brown-light);
  white-space: pre-line;
  text-shadow: 0.5px 0 0 currentColor, -0.5px 0 0 currentColor;  /* Simulated bold */
}
```

### Warm Wishes
```css
.gc-warm-wishes {
  font-family: var(--gc-font-title);
  font-size: 46px;
  font-weight: 500;
  color: var(--gc-text-gold);
  text-shadow: 0.5px 0 0 currentColor, -0.5px 0 0 currentColor;  /* Simulated bold */
}
```

---

## FEATURED SPREAD (Video + Album)

### Video Caption
```css
.gc-video-caption {
  font-family: var(--gc-font-title);
  font-size: 49px;                    /* +2 from 45px baseline */
  color: rgba(255, 255, 255, 0.85);
}
```

### Album Title (Cherished Moments)
```css
.gc-album-title {
  font-family: var(--gc-font-title);
  font-size: 49px;                    /* +2 from 45px baseline */
  font-weight: 500;
  color: var(--gc-text-brown);
}
```

### Photo Album Features
- Ken Burns effect: 4 variations (scale/translate animations)
- Auto-advance: 6 second intervals
- Background music: `/assets/music/slideshow-music.mp3`
- Mute button: Top-right corner
- Navigation buttons: HIDDEN (display: none)

---

## AI PROMPT FORMAT (generateWrittenIntro)

```
STRICT FORMAT (follow EXACTLY):
Line 1: ONLY the occasion phrase (e.g., "Happy Birthday!")
Line 2: BLANK LINE (this is required)
Lines 3+: Message body (3-4 sentences, max 8 lines)
```

Example:
```
Happy Birthday!

I hope this special day brings you everything you've been wishing for. You deserve all the happiness in the world.
```

---

## CSS VARIABLES REFERENCE

```css
--gc-letter-body-size: 50px;
--gc-font-title: /* Title font */
--gc-font-handwritten: /* Handwritten font */
--gc-font-body: /* Body font */
--gc-text-brown: /* Brown text color */
--gc-text-brown-light: /* Light brown text */
--gc-text-gold: /* Gold accent color */
```

---

## CANONICAL RULES

1. **Occasion line**: CENTERED, on its own line, separated by blank line from body
2. **Message body**: LEFT ALIGNED, no first paragraph indent
3. **Signature**: First name only, Title Case, bottom-right
4. **Poem/Warm Wishes**: Use text-shadow for simulated bold (font-weight alone insufficient)
5. **Max message lines**: 8 (enforced by CSS overflow:hidden and AI prompt)
6. **Photo album nav buttons**: HIDDEN

---

## COMMIT REFERENCES

- FRONTEND: `aebe9d5` - Typography refinements
- BACKEND: `41528c0` - AI prompt format fix
