/** Auto-generated from the inline tailwind.config that was in the HTML.
 *  Build: npm run build:css   (replaces cdn.tailwindcss.com)
 *  NOTE: main and pdf pages use the SAME class names with DIFFERENT values,
 *  so they get two separate stylesheets. Do not merge them.
 */
module.exports = {
  content: [
    "./*.html",
    "./blog/**/*.html",
    "./pdf/**/*.html",
    "./*.js",
    "./pdf/**/*.js"
  ],
  darkMode: "class",
  theme: {
    "extend": {
      "colors": {
        "secondary-container": "#fea619",
        "primary-fixed-dim": "#d2bbff",
        "on-error-container": "#93000a",
        "background": "#FAFAFC",
        "inverse-primary": "#d2bbff",
        "on-primary-fixed": "#25005a",
        "outline": "#7b7487",
        "on-primary": "#ffffff",
        "on-secondary-fixed": "#2a1700",
        "tertiary-fixed": "#ffdcc6",
        "surface": "#FAFAFC",
        "on-tertiary-fixed": "#301400",
        "primary": "#6D28D9",
        "on-surface-variant": "#4a4455",
        "surface-container-lowest": "#ffffff",
        "tertiary-fixed-dim": "#ffb784",
        "primary-fixed": "#eaddff",
        "on-surface": "#18131F",
        "on-secondary": "#ffffff",
        "secondary-fixed": "#ffddb8",
        "inverse-on-surface": "#f6eefc",
        "surface-dim": "#dfd7e6",
        "on-primary-fixed-variant": "#5a00c6",
        "secondary-fixed-dim": "#ffb95f",
        "on-background": "#18131F",
        "surface-container-highest": "#E4DEEE",
        "on-tertiary-fixed-variant": "#713700",
        "surface-variant": "#E4DEEE",
        "tertiary": "#7d3d00",
        "on-error": "#ffffff",
        "outline-variant": "#E4E0EC",
        "surface-tint": "#7C3AED",
        "error": "#ba1a1a",
        "on-secondary-fixed-variant": "#653e00",
        "inverse-surface": "#332f39",
        "on-primary-container": "#ffffff",
        "surface-container-high": "#EDE8F3",
        "surface-container-low": "#F7F5FA",
        "tertiary-container": "#a15100",
        "on-secondary-container": "#684000",
        "secondary": "#855300",
        "primary-container": "#7C3AED",
        "error-container": "#ffdad6",
        "surface-bright": "#FAFAFC",
        "on-tertiary-container": "#ffe0cd",
        "on-tertiary": "#ffffff",
        "surface-container": "#F3F0F8",
        "accent-teal": "#0891B2",
        "accent-rose": "#EC4899",
        "accent-success": "#10B981",
        "accent-gold": "#F59E0B",
        "accent-gold-dark": "#D97706"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "lg": "24px",
        "toolbar-width": "64px",
        "base": "4px",
        "md": "16px",
        "sm": "12px",
        "xs": "8px",
        "sidebar-width": "280px",
        "xl": "32px"
      },
      "fontFamily": {
        "body-lg": [
          "Inter"
        ],
        "label-md": [
          "Inter"
        ],
        "body-md": [
          "Inter"
        ],
        "headline-md": [
          "Outfit"
        ],
        "label-bold": [
          "Inter"
        ],
        "mono-label": [
          "Inter"
        ],
        "headline-lg": [
          "Outfit"
        ]
      },
      "fontSize": {
        "body-lg": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "500"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "letterSpacing": "-0.01em",
            "fontWeight": "600"
          }
        ],
        "label-bold": [
          "12px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.05em",
            "fontWeight": "600"
          }
        ],
        "mono-label": [
          "11px",
          {
            "lineHeight": "14px",
            "fontWeight": "500"
          }
        ],
        "headline-lg": [
          "30px",
          {
            "lineHeight": "38px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ]
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
