# F1 DataStop Design System

A comprehensive design system for the F1 DataStop application, ensuring consistency across all components and pages.

---

## 🎨 Design Principles

### Core Philosophy
1. **Information Density** - Display maximum useful data without clutter
2. **F1 Branding** - Subtle use of F1 Red (#e10600) as primary accent
3. **Glass Morphism** - Light frosted overlays, not heavy blur
4. **Dark-First Design** - Optimized for dark theme with light theme support
5. **Compact & Clean** - Dense layouts that remain readable
6. **Motion & Feedback** - Smooth animations for state changes

---

## 🎯 Color System

### Primary Colors
```css
--primary: #e10600;        /* F1 Red - CTAs, active states, badges */
--primary-foreground: #ffffff;
```

### Team Colors (2024 Season)
```typescript
const teamColors = {
  "Red Bull Racing": "#3671C6",
  "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "McLaren": "#FF8000",
  "Aston Martin": "#229971",
  "Alpine": "#FF87BC",
  "Williams": "#64C4FF",
  "RB": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Kick Sauber": "#52E252"
};
```

### Semantic Colors
```css
--success: #22c55e;        /* Position gained, improvements */
--danger: #ef4444;         /* Position lost, DNF, errors */
--warning: #f59e0b;        /* Pit stops, cautions */
--info: #3b82f6;           /* Data source badges, links */
--purple: #c026d3;         /* Fastest lap indicator */
```

### Glass Theme Variables
```css
/* Dark Glass */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);

/* Light Glass */
--glass-bg-light: rgba(0, 0, 0, 0.02);
--glass-border-light: rgba(0, 0, 0, 0.05);
```

---

## 📏 Typography

### Font Scale
```css
--text-2xl: 1.5rem;        /* Page titles */
--text-xl: 1.25rem;        /* Card titles */
--text-lg: 1.125rem;       /* Section headers */
--text-sm: 0.875rem;       /* Body text, labels */
--text-xs: 0.75rem;        /* Secondary text, badges */
--text-[10px]: 0.625rem;   /* Compact labels, status */
--text-[9px]: 0.5625rem;   /* Micro text, annotations */
```

### Font Weights
- **Bold (700)** - Driver codes, key metrics, positions
- **Semibold (600)** - Card titles, active states
- **Medium (500)** - Labels, buttons
- **Normal (400)** - Body text, descriptions

### Monospace Usage
Use `font-mono` for:
- Lap times (1:23.456)
- Positions (P1, P2)
- Percentages and statistics
- Time stamps

---

## 📦 Component Patterns

### Card Structure
```tsx
<Card className={cn(
  "overflow-hidden",
  isGlass && "bg-white/5 border-white/10 backdrop-blur-sm"
)}>
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Icon className="h-5 w-5 text-primary" />
        Title
      </CardTitle>
      <Badge variant="outline" className="text-xs">
        Status
      </Badge>
    </div>
    <CardDescription className="text-sm">
      Description text
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Stat Cards (Compact)
```tsx
<div className={cn(
  "rounded-lg p-2 text-center",
  isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50"
)}>
  <Icon className={cn("h-4 w-4 mx-auto mb-1", colorClass)} />
  <div className="text-lg font-bold">{value}</div>
  <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
</div>
```

### Loading States
```tsx
// Centered loader with context
<div className="min-h-[400px] flex flex-col items-center justify-center p-4">
  <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
  <p className="text-sm text-muted-foreground">Loading {context}...</p>
</div>

// Progress loader for data fetching
<div className="flex flex-col items-center justify-center space-y-3 max-w-xs">
  <Loader2 className="h-6 w-6 animate-spin text-primary" />
  <div className="w-full space-y-2 text-center">
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <span>Loading data</span>
      <span className="font-mono text-xs">{progress}%</span>
    </div>
    <Progress value={progress} className="h-1.5 w-full" />
  </div>
</div>
```

### Empty States
```tsx
<div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
  <ContextIcon className="h-8 w-8 text-muted-foreground mb-3" />
  <p className="text-muted-foreground font-medium">No {data} available</p>
  <p className="text-sm text-muted-foreground mt-1">{helpText}</p>
</div>
```

### Error States
```tsx
<div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
  <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
  <p className="text-muted-foreground font-medium">{title}</p>
  <p className="text-sm text-muted-foreground mt-1">{message}</p>
  <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
    <RefreshCw className="h-3 w-3 mr-1.5" />
    Retry
  </Button>
</div>
```

---

## 🔘 Button Patterns

### Sizes
```tsx
size="sm"     // h-7, text-xs - Default for most UI
size="default" // h-9 - Primary actions
size="lg"     // h-11 - Hero CTAs
```

### Compact Buttons
```tsx
<Button
  variant="outline"
  size="sm"
  className="h-7 gap-1.5 text-xs"
>
  <Icon className="h-3.5 w-3.5" />
  Label
</Button>
```

### Speed/Toggle Buttons
```tsx
<button
  onClick={() => setSpeed(value)}
  className={cn(
    "w-6 h-6 rounded text-[10px] font-bold transition-colors",
    isActive 
      ? "bg-primary text-white" 
      : isDark 
        ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700" 
        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
  )}
>
  {value}x
</button>
```

---

## 📊 Chart Patterns

### MUI X Charts Wrapper
Always wrap MUI charts with `MuiThemeWrapper`:
```tsx
<MuiThemeWrapper>
  <div className="h-[300px]">
    <LineChart {...props} />
  </div>
</MuiThemeWrapper>
```

### Chart Margins
```tsx
margin={{ 
  left: isMobile ? 35 : 45,   // Accommodate axis labels
  right: 10,                   // Minimal right padding
  top: 10,                     // Space for legend if needed
  bottom: 35                   // Space for x-axis label
}}
```

### Axis Styling
```tsx
tickLabelStyle: {
  fontSize: isMobile ? 10 : 11,
  fill: isDark ? '#a1a1aa' : '#666'
}
```

### Grid Styling
```tsx
grid={{ vertical: false, horizontal: true }}  // Prefer horizontal only
```

### Line Chart Defaults
```tsx
series={[{
  data: values,
  label: 'Label',
  color: teamColor,
  showMark: false,         // No dots for cleaner look
  curve: 'linear',         // or 'stepAfter' for positions
  connectNulls: true,
}]}
```

---

## 🏷️ Badge Patterns

### Data Source Badges
```tsx
<Badge 
  variant="outline" 
  className="text-[10px] px-1.5 py-0 h-5 gap-1 cursor-pointer"
>
  <Icon className="h-3 w-3" />
  Label
  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
</Badge>
```

### Position Change Badges
```tsx
<div className={cn(
  "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold",
  isGain && "bg-green-500/20 text-green-500",
  isLoss && "bg-red-500/20 text-red-500"
)}>
  {isGain ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
  {Math.abs(change)}
</div>
```

### Fastest Lap Badge
```tsx
<Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
  <Zap className="h-3 w-3 mr-0.5" fill="currentColor" />
  {formattedTime}
</Badge>
```

---

## 🎛️ Driver Selection Grid

### Compact Chip Layout
```tsx
<div className={cn(
  "grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-0.5 p-1 rounded border",
  isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
)}>
  {drivers.map(driver => (
    <button
      className={cn(
        "flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium",
        isSelected && (isDark ? "bg-zinc-800 text-white" : "bg-white shadow-sm"),
        !isSelected && "opacity-60 hover:opacity-100"
      )}
      style={{ borderLeft: `2px solid ${teamColor}` }}
    >
      <span 
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isSecondTeammate && "ring-1 ring-offset-0"
        )}
        style={{ backgroundColor: teamColor }}
      />
      <span className="font-bold">{code}</span>
    </button>
  ))}
</div>
```

### Teammate Indicator Legend
```tsx
<div className="flex items-center gap-2 text-[8px] text-muted-foreground">
  <span className="flex items-center gap-0.5">
    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
    1st driver
  </span>
  <span className="flex items-center gap-0.5">
    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 ring-1 ring-zinc-400" />
    2nd driver
  </span>
</div>
```

---

## 🏆 Podium Display

### Podium Layout (P2-P1-P3)
```tsx
<div className="flex items-end justify-center gap-3 h-32 mb-4">
  {[1, 0, 2].map((idx) => {  // Order: P2, P1, P3
    const heights = ['h-24', 'h-20', 'h-16'];
    const driver = results[idx];
    
    return (
      <motion.div 
        initial={{ y: 50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: idx * 0.1 }}
      >
        {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500 mb-1" />}
        <div 
          className="rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: driver.color }}
        >
          {driver.acronym}
        </div>
        <div className={cn(
          heights[idx], 
          "rounded-t flex items-center justify-center",
          idx === 0 && "bg-gradient-to-b from-yellow-400 to-yellow-600",
          idx === 1 && "bg-gradient-to-b from-slate-300 to-slate-500",
          idx === 2 && "bg-gradient-to-b from-amber-500 to-amber-700"
        )}>
          <span className="text-xl font-bold text-white">{position}</span>
        </div>
      </motion.div>
    );
  })}
</div>
```

---

## 🔄 Animation Patterns

### Framer Motion for List Reordering
```tsx
<AnimatePresence>
  {items.map(item => (
    <motion.div
      key={item.id}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        backgroundColor: isHighlighted ? 'rgba(34, 197, 94, 0.15)' : 'transparent'
      }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ 
        layout: { type: "spring", stiffness: 350, damping: 30 },
        backgroundColor: { duration: 0.5 }
      }}
    >
      {/* Content */}
    </motion.div>
  ))}
</AnimatePresence>
```

### CSS Animations
```tsx
// Staggered fade in
className="animate-in fade-in slide-in-from-bottom-4"
style={{ animationDelay: `${index * 30}ms` }}

// Pulse for live indicators
className="animate-pulse"

// Spin for loaders
className="animate-spin"
```

---

## 📱 Responsive Patterns

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Wide screens */
```

### Grid Responsiveness
```tsx
className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"
```

### Chart Height Responsiveness
```tsx
const chartHeight = isMobile ? 220 : 280;
```

---

## 🌓 Theme Patterns

### Theme-Aware Styling
```tsx
const { isGlass, baseTheme } = useTheme();
const isDark = baseTheme === 'dark';

<div className={cn(
  "rounded-lg p-3",
  isGlass 
    ? "bg-white/5 border border-white/10" 
    : isDark 
      ? "bg-zinc-900" 
      : "bg-white border border-slate-200"
)}>
```

### Icon Colors
```tsx
// Theme-aware icon colors
className={isDark ? "text-zinc-400" : "text-slate-500"}

// Semantic icon colors (always visible)
className="text-primary"      // Actions
className="text-green-500"    // Positive
className="text-red-500"      // Negative
className="text-amber-500"    // Warning
className="text-purple-500"   // Special (fastest lap)
```

---

## 📋 Tab Patterns

### Compact Tabs
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className={cn(
    "inline-flex h-8",
    isGlass && "bg-white/5 border border-white/10"
  )}>
    <TabsTrigger value="tab1" className="text-xs px-3">
      Tab 1
    </TabsTrigger>
    <TabsTrigger value="tab2" className="text-xs px-3">
      Tab 2
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="tab1" className="mt-3">
    {/* Content */}
  </TabsContent>
</Tabs>
```

---

## ✅ Best Practices

### Do's
- ✅ Use `cn()` for conditional classes
- ✅ Include loading and error states
- ✅ Use semantic colors for status
- ✅ Add hover states for interactive elements
- ✅ Use `font-mono` for numerical data
- ✅ Include team colors for driver identification
- ✅ Add smooth animations for state changes
- ✅ Use compact sizing (`text-xs`, `text-[10px]`) for dense data

### Don'ts
- ❌ Don't use inline styles for theme colors
- ❌ Don't skip empty/loading states
- ❌ Don't use colors without semantic meaning
- ❌ Don't forget dark mode compatibility
- ❌ Don't use heavy blur effects
- ❌ Don't create overly busy visualizations
- ❌ Don't mix monospace and regular fonts in same metric

---

## 📁 File Organization

```
src/
├── components/
│   ├── analytics/           # Data visualization components
│   │   ├── charts/         # Reusable chart components
│   │   ├── MuiThemeWrapper.tsx
│   │   └── [Component].tsx
│   ├── common/              # Shared UI components
│   ├── dashboard/           # Dashboard-specific components
│   ├── f1/                  # F1-branded components
│   ├── layout/              # Layout components
│   └── ui/                  # shadcn/ui components
├── hooks/                   # Custom React hooks
├── lib/                     # Utility functions
├── constants/               # F1 colors, team data
└── context/                 # Theme and state contexts
```

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Dec 2024 | Initial design system documentation |

---

*This design system should be referenced for all new component development to ensure consistency across the F1 DataStop application.*

