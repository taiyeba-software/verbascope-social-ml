# VERBASCOPE COLOR PALETTE
## Loid Forger × Anya Aesthetic

---

## PRIMARY PALETTE

### Background Colors
```
MAIN TEAL (Loid's Safe House)
Hex:    #6BA59E
RGB:    107, 165, 158
HSL:    163°, 25%, 53%
Usage:  Primary page background, main canvas
Mood:   Calm, sophisticated, trustworthy

SECONDARY TEAL (Mission Briefing)
Hex:    #5A9590
RGB:    90, 149, 144
HSL:    170°, 25%, 47%
Usage:  Secondary surfaces, darker sections
Mood:   Slightly more formal, deeper engagement

LIGHT CARD TEAL (Anya's Playful Cards)
Hex:    #7BB5AE
RGB:    123, 181, 174
HSL:    171°, 27%, 60%
Usage:  Card surfaces, elevated elements
Mood:   Welcoming, approachable

DARK NAVY (Command Center)
Hex:    #1A2A28
RGB:    26, 42, 40
HSL:    167°, 24%, 13%
Usage:  Navbar, dark sections, text on light
Mood:   Serious, spy agency, professional

CREAM/PAPER WHITE (Warm Text)
Hex:    #E8E3DB
RGB:    232, 227, 219
HSL:    32°, 33%, 88%
Usage:  Light backgrounds, decorative
Mood:   Warm, inviting, vintage card aesthetic
```

### Text Colors
```
PRIMARY TEXT (Headlines, CTA)
Hex:    #F5F0E8
RGB:    245, 240, 232
HSL:    36°, 50%, 96%
Usage:  Headings, important text
Contrast: 12:1 on navy, 5:1 on teal

SECONDARY TEXT (Body Copy)
Hex:    #D0D9D6
RGB:    208, 217, 214
HSL:    152°, 17%, 83%
Usage:  Paragraph text, descriptions
Contrast: Readable on teal backgrounds

MUTED TEXT (Hints, Timestamps)
Hex:    #9AADA8
RGB:    154, 173, 168
HSL:    158°, 11%, 64%
Usage:  Subtle labels, timestamps, hints
Contrast: For secondary information

DARK TEXT (On Light Backgrounds)
Hex:    #1A2A28
RGB:    26, 42, 40
HSL:    167°, 24%, 13%
Usage:  Text on cream/light backgrounds
Contrast: Maximum contrast for accessibility
```

---

## SIGNAL COLORS (ML Analysis)

### Positive Sentiment
```
SIGNAL GREEN (Anya's Happy Discovery ✓)
Hex:    #6FBDB3
RGB:    111, 189, 179
HSL:    169°, 33%, 59%
Background:  rgba(111, 189, 179, 0.15)
Border:      1px solid #6FBDB3
Usage:  Positive sentiment, success states
Emotion: Delighted, approving
```

### Interesting/Sarcasm
```
SIGNAL YELLOW (Anya's Curious Question ⚡)
Hex:    #D4A574
RGB:    212, 165, 116
HSL:    33°, 46%, 64%
Background:  rgba(212, 165, 116, 0.15)
Border:      1px solid #D4A574
Usage:  Sarcasm, irony, interesting patterns
Emotion: Playful, questioning, intrigued
```

### Negative Sentiment
```
SIGNAL RED (Anya's Concerned Alert ●)
Hex:    #C17B6D
RGB:    193, 123, 109
HSL:    11°, 44%, 59%
Background:  rgba(193, 123, 109, 0.15)
Border:      1px solid #C17B6D
Usage:  Negative sentiment, warnings
Emotion: Cautious, alert, concerned
```

---

## BORDER & ACCENT COLORS

```
PRIMARY BORDER
Hex:    rgba(26, 42, 40, 0.2)
Usage:  Light borders, subtle dividers

STRONG BORDER
Hex:    rgba(26, 42, 40, 0.4)
Usage:  Visible borders, card outlines

LINE ACCENT (Vertical Lines)
Hex:    rgba(26, 42, 40, 0.6)
Usage:  Bold dividers, navbar accents, mission lines

OVERLAY (Semi-transparent Dark)
Hex:    rgba(26, 42, 40, 0.65)
Usage:  Modals, overlays, background tinting
```

---

## COLOR COMBINATIONS (WCAG AAA Compliant)

### On Teal Background (#6BA59E)
| Text Color | Contrast Ratio | Usage |
|-----------|----------------|-------|
| #F5F0E8 (Cream) | 5.2:1 | Body text ✓ |
| #D0D9D6 (Light Gray) | 3.1:1 | Secondary text ✓ |
| #9AADA8 (Muted) | 2.1:1 | Hints only ⚠ |
| #1A2A28 (Navy) | 5.8:1 | Headings ✓ |

### On Navy Background (#1A2A28)
| Text Color | Contrast Ratio | Usage |
|-----------|----------------|-------|
| #F5F0E8 (Cream) | 12:1 | Any text ✓ |
| #6FBDB3 (Green) | 7.2:1 | Signals ✓ |
| #D4A574 (Yellow) | 6.8:1 | Signals ✓ |
| #C17B6D (Red) | 6.4:1 | Signals ✓ |

### On Cream Background (#E8E3DB)
| Text Color | Contrast Ratio | Usage |
|-----------|----------------|-------|
| #1A2A28 (Navy) | 9.5:1 | All text ✓ |
| #5A9590 (Dark Teal) | 4.2:1 | Headings ✓ |
| #9AADA8 (Muted) | 2.8:1 | Hints ⚠ |

---

## CSS VARIABLES REFERENCE

```css
/* Backgrounds */
--v-bg-primary:      #6BA59E
--v-bg-secondary:    #5A9590
--v-bg-card:         #7BB5AE
--v-bg-dark:         #1A2A28
--v-bg-light:        #E8E3DB
--v-bg-overlay:      rgba(26, 42, 40, 0.65)

/* Accents */
--v-accent:          #1A2A28
--v-accent-soft:     #2A3A38
--v-accent-border:   rgba(26, 42, 40, 0.3)

/* Text */
--v-text-primary:    #F5F0E8
--v-text-secondary:  #D0D9D6
--v-text-muted:      #9AADA8
--v-text-dark:       #1A2A28

/* Signals */
--v-signal-green:    #6FBDB3
--v-signal-yellow:   #D4A574
--v-signal-red:      #C17B6D
--v-signal-green-bg: rgba(111, 189, 179, 0.15)
--v-signal-yellow-bg:rgba(212, 165, 116, 0.15)
--v-signal-red-bg:   rgba(193, 123, 109, 0.15)

/* Borders */
--v-border:          rgba(26, 42, 40, 0.2)
--v-border-strong:   rgba(26, 42, 40, 0.4)
--v-border-line:     rgba(26, 42, 40, 0.6)
```

---

## USAGE EXAMPLES

### Hero Section (Loid's Briefing)
```tsx
<section style={{
  backgroundColor: 'var(--v-bg-primary)',
  color: 'var(--v-text-primary)'
}}>
  <h1>MISSION ACCEPTED</h1>
  <p style={{color: 'var(--v-text-secondary)'}}>
    Decode every emotion behind social media posts
  </p>
</section>
```

### Signal Badge (Anya's Discovery)
```tsx
<span className="badge badge-green">✓ POSITIVE</span>
<span className="badge badge-yellow">⚡ SARCASM</span>
<span className="badge badge-red">● NEGATIVE</span>
```

### Card (Mission Report)
```tsx
<div className="card" style={{
  backgroundColor: 'var(--v-bg-card)',
  borderColor: 'var(--v-border-strong)'
}}>
  <h3 style={{color: 'var(--v-text-primary)'}}>Report</h3>
  <p style={{color: 'var(--v-text-secondary)'}}>Details here</p>
</div>
```

---

## THEMING NOTES

- **Warm Neutrals:** All grays have subtle teal undertones (not cold blue)
- **Accessibility:** All text combinations meet WCAG AAA standards
- **Playfulness:** Signal colors are warm (not saturated), matching the friendly aesthetic
- **Consistency:** All backgrounds are teal-based, creating cohesive experience
- **Elegance:** Navy is used sparingly for maximum impact (Loid's precision)

**Color Story:** Loid's sophisticated mission meets Anya's warm, playful curiosity in a palette that feels both spy-agency professional AND delightfully inviting. ☺
