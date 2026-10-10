# F1 DataStop Embeddable Components

This documentation explains how to use the embeddable components from F1 DataStop on your website or blog.

## Available Components

F1 DataStop provides responsive, customizable embeddable components that you can add to your website to display Formula 1 data.

### 1. Driver Standings

Display current or historical F1 driver standings with customizable theme and font options.

```html
<iframe 
  src="https://f1datastop.com/embed/driver-standings?season=2023&theme=light&font=Roboto,%20sans-serif" 
  width="100%" 
  height="500px" 
  frameborder="0"
></iframe>
```

### 2. Constructor Standings

Display current or historical F1 constructor standings with customizable theme and font options.

```html
<iframe 
  src="https://f1datastop.com/embed/constructor-standings?season=2023&theme=dark&font=Open%20Sans,%20sans-serif" 
  width="100%" 
  height="400px" 
  frameborder="0"
></iframe>
```

## Customization Parameters

All embeddable components accept the following query parameters:

| Parameter | Description | Options | Default |
|-----------|-------------|---------|---------|
| `season` | The F1 season year to display | 1950-present | Current year |
| `theme` | Color theme for the component | `light`, `dark` | `light` |
| `font` | Font family for the component | Any web-safe font | `Inter` |

## Features

- **Clean Table-Only Design**: Components display just the data table without any extra UI controls or headers
- **Responsive Design**: Tables adjust to fit the container width
- **Light/Dark Themes**: Choose between light and dark color schemes via URL parameters
- **Historical Data**: View data from previous seasons (1950 onwards)
- **Font Customization**: Match the component's typography with your site's design
- **Self-contained**: No external CSS or JavaScript required
- **Low Impact**: Minimal impact on your site's performance
- **Subtle Branding**: Includes a minimal footer with F1 DataStop attribution and X link

## Implementation Tips

- Set the iframe width to `100%` for responsive design
- Adjust the height based on the amount of data displayed (e.g., 400px for constructor standings, 500px for driver standings)
- For custom fonts, use URL-encoded values (e.g., `Roboto,%20sans-serif`)
- Add a border with CSS if needed to match your site's design

## Working Locally

If you're testing these components locally, use:

```html
<iframe 
  src="http://localhost:8080/embed/driver-standings?season=2023&theme=light&font=Inter" 
  width="100%" 
  height="500px" 
  frameborder="0"
></iframe>
```

## Terms of Use

- These components are free to use with attribution
- All data is sourced from the Ergast Developer API and is subject to their terms
- F1 DataStop is not affiliated with Formula 1, FIA, or the Ergast Developer API

## Browser Support

The embeddable components work in all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Troubleshooting

If you encounter issues with the embeds:

1. Check that your iframe URL is correctly formatted
2. Ensure you have an active internet connection
3. Verify that your content security policy allows iframes from `f1datastop.com`
4. Try refreshing the page

For additional help, contact support@f1datastop.com