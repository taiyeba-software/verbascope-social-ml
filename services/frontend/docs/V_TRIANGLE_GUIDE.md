# V-Triangle Decoration Guide

## Mission Standard

Operation V-Triangle is now the active visual standard for Verbascope. The element is a right-angled dot matrix that points inward to guide focus toward core content.

## How to Use V-Triangles

### Basic Usage
```jsx
<div className="dot-triangle small top-right"></div>
```

### Size Classes
```jsx
<div className="dot-triangle small"></div>      {/* 60px */}
<div className="dot-triangle medium"></div>     {/* 100px */}
<div className="dot-triangle large"></div>      {/* 160px */}
```

### Position Classes (Combine One Size + One Position)
```jsx
{/* Top positions */}
<div className="dot-triangle small top-right"></div>
<div className="dot-triangle medium top-left"></div>

{/* Bottom positions */}
<div className="dot-triangle small bottom-right"></div>
<div className="dot-triangle medium bottom-left"></div>

{/* Middle positions (vertically centered) */}
<div className="dot-triangle large middle-right"></div>
<div className="dot-triangle large middle-left"></div>
```

## Visual Breakdown

### Size Variations
- **Small (60px)** - Perfect for corners, subtle accents
- **Medium (100px)** - Balanced, works everywhere
- **Large (160px)** - Hero sections, statement pieces

### Position Behavior
- **top-right** - Normal orientation
- **top-left** - Flipped horizontally (scaleX(-1))
- **bottom-right** - Flipped vertically (scaleY(-1))
- **bottom-left** - Flipped horizontally + vertically
- **middle-right** - Centered vertically on right
- **middle-left** - Centered vertically on left (flipped)

## Current Implementation

### Home Page
```jsx
<div className="dot-triangle small top-right"></div>
<div className="dot-triangle medium bottom-left"></div>
<div className="dot-triangle small top-left"></div>
```

### Register Page
```jsx
<div className="dot-triangle medium top-right"></div>
<div className="dot-triangle small bottom-left"></div>
```

### Login Page
```jsx
<div className="dot-triangle large top-right"></div>
<div className="dot-triangle small bottom-left"></div>
```

## CSS Classes Reference

```css
/* Container element */
.dot-triangle {
  position: absolute;
  pointer-events: none;
  opacity: 0.8;
  background-image: radial-gradient(
    circle,
    var(--v-accent) var(--v-dot-size),
    transparent var(--v-dot-size)
  );
  background-size: var(--v-gap) var(--v-gap);
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  animation: triangle-pulse 8s ease-in-out infinite;
}

/* Sizes */
.dot-triangle.small { width: 60px; height: 60px; }
.dot-triangle.medium { width: 100px; height: 100px; }
.dot-triangle.large { width: 160px; height: 160px; }

/* Positions */
.dot-triangle.top-right { top: 30px; right: 30px; }
.dot-triangle.top-left { top: 30px; left: 30px; transform: scaleX(-1); }
.dot-triangle.bottom-right { bottom: 30px; right: 30px; transform: scaleY(-1); }
```

## Customization

To customize triangles, edit in `app/globals.css`:

### Change Dot Size
```css
.dot-triangle {
  --v-gap: 12px;  /* Change this */
}
```

### Change Dot Color
```css
.dot-triangle {
  background-image: radial-gradient(
    circle,
    #YOUR_COLOR var(--v-dot-size),  /* Change this */
    transparent var(--v-dot-size)
  );
}
```

### Change Triangle Opacity
```css
.dot-triangle {
  opacity: 0.8;  /* Change this */
}
```

### Modify Animation
```css
@keyframes triangle-pulse {
  0% {
    opacity: 0.4;
    transform: translate(0, 0);
  }
  50% {
    opacity: 0.8;
    transform: translate(-5px, 5px);  /* Change offset */
  }
  100% {
    opacity: 0.4;
    transform: translate(0, 0);
  }
}
```

## Standard Issue Sizes

| Size | Intent | Dimension |
|------|--------|-----------|
| Small | Discrete intel | 60px |
| Medium | Field operation | 100px |
| Large | Commander deck | 160px |

## Best Practices

1. **Asymmetry is key** - Keep the right-angle clip as `polygon(100% 0, 0 0, 100% 100%)`.
2. **Corner lock** - Use matching edge values (for example `top: 30px; right: 30px;`) for a boxed-in look.
3. **Visual silence** - Max 2-3 triangles per view unless used as data-card anchors.
4. **Interaction safety** - Keep `pointer-events: none` so decoration never blocks inputs.
5. **Palette discipline** - Use `#1A2A28` or `#000000`; use `#A3B8B5` only for dark backgrounds.

## Animation Details

Triangles now use a continuous pulse sweep:
```css
@keyframes triangle-pulse {
  0% { opacity: 0.4; transform: translate(0, 0); }
  50% { opacity: 0.8; transform: translate(-5px, 5px); }
  100% { opacity: 0.4; transform: translate(0, 0); }
}
```

Duration: 8 seconds
Easing: ease-in-out
Effect: Subtle diagonal radar-style sweep

## Color Usage

V-triangles use `var(--v-accent)` which is `#1A2A28` (deep navy)

This color is defined in `app/globals.css`:
```css
--v-accent: #1A2A28;  /* Deep navy — mission critical */
--v-dot-size: 2px;
--v-gap: 12px;
```

## Intelligence Brief: Current Deployments

- Landing page: one large triangle in top-right.
- Auth pages: one medium triangle in top-right, one small in bottom-left.
- Dashboard/feed: multiple small triangles as card anchors.

---

Mission directive: maintain visual silence. Triangles should guide the eye to Verbascope's core data without calling attention to themselves.
