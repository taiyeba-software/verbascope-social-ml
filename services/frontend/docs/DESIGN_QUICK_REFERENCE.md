# Verbascope Design — Quick Reference

## Elegant Symbols (Instead of Emoji)

```
✦  Sarcasm / Sparkling / Light & Whimsical
◉  Emotion / Pulse / Watchful & Aware
⌁  Tone / Wave / Flow & Movement
⟡  Social / Echoes / Geometric & Complex
◎  Behavior / Drift / Orbital & Scanning
◌  Insight / Neural / Hollow & Thoughtful
⊹  Signal / Burst / Radiant & Energetic
⟢  Wave / Pattern / Flowing Data
◈  Orbital / Scan / Technical & Precise
```

---

## Lucide React Icons

| Icon | Size | Use Case |
|------|------|----------|
| `Sparkles` | 28px | Sarcasm Detection (whimsical) |
| `Radar` | 28px | Sentiment Analysis (scanning) |
| `Brain` | 28px | ML Intelligence (thinking) |
| `Activity` | 18px | Live Indicator (active) |
| `Waves` | 24px | Tone Analysis (emotion) |
| `Radio` | 24px | Signal Processing |
| `Orbit` | 24px | Data Processing |
| `Zap` | 24px | Speed / Efficiency |

**Styling:**
```css
color: var(--v-signal-green);
stroke-width: 1.5;
opacity: 0.8;
transition: all 0.2s ease;

/* On Hover */
opacity: 1;
background: rgba(111, 189, 179, 0.1);
```

---

## Color Palette

| Color | Hex | Usage | Meaning |
|-------|-----|-------|---------|
| **Sage Teal** | `#6BA59E` | Primary background | Calm, intel agency |
| **Deep Navy** | `#1A2A28` | Text, accents, authority | Command, sophistication |
| **Warm Cream** | `#F5F0E8` | Primary text | Elegant, readable |
| **Soft Gray** | `#D0D9D6` | Secondary text | Subtle, muted |
| **Muted Sage** | `#9AADA8` | Hints, timestamps | Whispered information |
| **Signal Green** | `#6FBDB3` | Positive, live indicators | Healthy, alive |
| **Signal Yellow** | `#D4A574` | Sarcasm, complexity | Caution, nuance |
| **Signal Red** | `#C17B6D` | Negative, warnings | Concern, alert |

---

## Typography

| Role | Font | Size | Weight | Usage |
|------|------|------|--------|-------|
| **Display** | Bodoni Moda | 2.5rem | 700 | H1 titles |
| **Heading Large** | Playfair Display | 1.875rem | 700 | H2 sections |
| **Heading Medium** | Playfair Display | 1.25rem | 600 | H3 subsections |
| **Body** | Inter | 0.95rem | 400 | Content, descriptions |
| **Label** | Inter | 0.65rem | 600 | Spaced caps, tags |
| **Mono** | Courier New | 0.9rem | 400 | Code, data |

---

## Animations

### Breathing Pulse (Live Indicator)
```css
animation: breathing-pulse 3s ease-in-out infinite;
```
**Feel:** Calm, natural, medical-monitor-like  
**Duration:** 3 seconds  
**Effect:** Opacity + scale + glow ring

### Floating Gradient (Background)
```css
animation: floating-glow 8s ease-in-out infinite;
```
**Feel:** Ambient, peaceful, emotionally aware  
**Duration:** 8 seconds  
**Effect:** Smooth position drift + opacity change

### Scan Line (Optional)
```css
animation: scan-line 6s ease-in-out infinite;
```
**Feel:** Subtle sci-fi, data processing  
**Duration:** 6 seconds  
**Effect:** Linear gradient descent with fade

---

## Card Design

### Visual Hierarchy
```css
/* Premium Elevation */
box-shadow: 0 8px 32px rgba(26, 42, 40, 0.25),
            0 0 40px rgba(111, 189, 179, 0.1);

/* Glass Effect */
backdrop-filter: blur(10px);
border: 1px solid rgba(26, 42, 40, 0.4);

/* Highlight */
::before {
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.1) 0%, 
    transparent 50%);
}
```

### Post Card Accent
```css
border-left: 3px solid var(--v-accent);

/* Hover */
border-left-color: var(--v-signal-green);
transition: border-left-color 0.2s ease;
```

---

## Badge Styles

```jsx
/* Green Badge */
<span className="badge badge-green">✦ Positive</span>

/* Yellow Badge */
<span className="badge badge-yellow">◉ Sarcasm</span>

/* Red Badge */
<span className="badge badge-red">⌁ Negative</span>
```

**Colors:**
- Background: 15% opacity signal color
- Text: 100% signal color
- Border: Signal color with transparency

---

## Button Styles

```jsx
/* Primary Button */
<button className="btn btn-primary">Action</button>

/* Ghost Button */
<button className="btn btn-ghost">Secondary</button>

/* Outline Button */
<button className="btn btn-outline">Tertiary</button>
```

**Hover Effects:**
- Primary: Darker background, slight lift
- Ghost: Background fade-in, text brighten
- Outline: Invert to solid fill

---

## Spacing Scale

| Size | Value | Usage |
|------|-------|-------|
| **XS** | 4px | Tight spacing, micro gaps |
| **SM** | 8px | Icon spacing, small gaps |
| **MD** | 16px | Component padding |
| **LG** | 24px | Section spacing |
| **XL** | 40px | Hero section, large layouts |

---

## Border Radius

| Size | Value | Usage |
|------|-------|-------|
| **SM** | 6px | Buttons, small elements |
| **MD** | 12px | Cards, standard elements |
| **LG** | 20px | Large cards, panels |
| **FULL** | 9999px | Pills, badges, circles |

---

## Do's ✓

✓ Use elegant unicode symbols instead of emoji  
✓ Use lucide-react for feature icons  
✓ Keep animations subtle & cinematic  
✓ Use soft shadows and glow effects  
✓ Maintain the Loid Forger aesthetic  
✓ Layer gradients for depth  
✓ Use breathing animations (3-8s duration)  
✓ Keep icon strokeWidth at 1.5  
✓ Preserve spacing consistency  
✓ Test color contrast (WCAG AAA)  

---

## Don'ts ❌

❌ Don't use colorful emoji (🤖 🧠 📊)  
❌ Don't use generic startup icons (rocket, lightbulb)  
❌ Don't add flashy animations (bouncing, spinning)  
❌ Don't use neon colors (pure bright cyan, magenta)  
❌ Don't mix icon styles (emoji + lucide + custom)  
❌ Don't over-animate (every element moving)  
❌ Don't use heavy shadows (outdated look)  
❌ Don't change the color palette  
❌ Don't add unnecessary blur effects  
❌ Don't sacrifice performance for visuals  

---

## Implementation Checklist

When adding new features:

- [ ] Replace any emoji with unicode symbols
- [ ] Use lucide-react icons if available
- [ ] Apply premium card shadow: `0 8px 32px rgba(26,42,40,0.25)`
- [ ] Add glow effect if interactive: `0 0 40px rgba(111,189,179,0.1)`
- [ ] Use breathing animation (3-8s) if live indicator
- [ ] Test on mobile (responsive breakpoints)
- [ ] Ensure icon is 18-28px
- [ ] Check color contrast ratio (4.5:1 minimum)
- [ ] Verify animation is GPU-accelerated (transform only)
- [ ] Document new symbols in DESIGN_QUICK_REFERENCE.md

---

## Example: Adding a New Feature

### Before (Generic)
```jsx
<div className="feature">
  <span className="icon">🚀</span>
  <h3>Fast Processing</h3>
  <p>Quick results</p>
</div>
```

### After (Premium)
```jsx
import { Zap } from 'lucide-react';

<div className="feature">
  <div className="feature-icon">
    <Zap size={28} strokeWidth={1.5} />
  </div>
  <h3>Fast Processing</h3>
  <p>Quick results</p>
</div>
```

### Styling
```css
.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--v-radius-md);
  background: rgba(111, 189, 179, 0.1);
  color: var(--v-signal-green);
  transition: all 0.2s ease;
}

.feature:hover .feature-icon {
  background: rgba(111, 189, 179, 0.2);
  transform: scale(1.05);
}
```

---

## Resources

- **Icons:** lucide-react.com (1500+ icons)
- **Colors:** Use CSS variables (--v-signal-green, etc.)
- **Fonts:** Google Fonts (Bodoni Moda, Playfair Display, Inter)
- **Animation:** Use hardware acceleration (transform, opacity)
- **Design System:** REFINED_DESIGN.md (comprehensive guide)

---

**Status:** Premium, Emotionally Intelligent, Production Ready ✓
