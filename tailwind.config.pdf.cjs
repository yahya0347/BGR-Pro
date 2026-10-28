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
        "tertiary-container": "#905b00",
        "on-surface-variant": "#4a4455",
        "on-secondary": "#ffffff",
        "surface-tint": "#732ee4",
        "on-primary-fixed-variant": "#5a00c6",
        "on-error": "#ffffff",
        "surface-container": "#edeeef",
        "on-primary-container": "#ede0ff",
        "secondary-fixed-dim": "#ffb0cd",
        "surface-container-lowest": "#ffffff",
        "on-background": "#191c1d",
        "inverse-primary": "#d2bbff",
        "outline-variant": "#ccc3d8",
        "tertiary": "#704500",
        "on-secondary-fixed-variant": "#8c0053",
        "secondary-fixed": "#ffd9e4",
        "inverse-on-surface": "#f0f1f2",
        "on-primary-fixed": "#25005a",
        "on-primary": "#ffffff",
        "surface-container-low": "#f3f4f5",
        "secondary-container": "#fd56a7",
        "outline": "#7b7487",
        "primary": "#630ed4",
        "primary-fixed": "#eaddff",
        "on-tertiary-container": "#ffe1c0",
        "surface-container-highest": "#e1e3e4",
        "primary-fixed-dim": "#d2bbff",
        "on-tertiary-fixed": "#2a1700",
        "on-secondary-fixed": "#3e0022",
        "on-error-container": "#93000a",
        "on-tertiary": "#ffffff",
        "error-container": "#ffdad6",
        "surface-dim": "#d9dadb",
        "surface-variant": "#e1e3e4",
        "on-tertiary-fixed-variant": "#653e00",
        "tertiary-fixed": "#ffddb8",
        "secondary": "#b4136d",
        "error": "#ba1a1a",
        "on-secondary-container": "#600037",
        "background": "#f8f9fa",
        "surface": "#f8f9fa",
        "primary-container": "#7c3aed",
        "on-surface": "#191c1d",
        "tertiary-fixed-dim": "#ffb95f",
        "surface-bright": "#f8f9fa",
        "surface-container-high": "#e7e8e9",
        "inverse-surface": "#2e3132"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "lg": "24px",
        "xl": "32px",
        "gutter": "16px",
        "xs": "4px",
        "container-margin": "24px",
        "base": "4px",
        "sm": "8px",
        "md": "16px"
      },
      "fontFamily": {
        "headline-sm": [
          "Geist"
        ],
        "headline-md": [
          "Geist"
        ],
        "headline-lg": [
          "Geist"
        ],
        "body-lg": [
          "Geist"
        ],
        "headline-lg-mobile": [
          "Geist"
        ],
        "body-md": [
          "Geist"
        ],
        "label-md": [
          "Geist"
        ],
        "display-lg": [
          "Geist"
        ]
      },
      "fontSize": {
        "headline-sm": [
          "20px",
          {
            "lineHeight": "1.4",
            "fontWeight": "600"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "1.3",
            "fontWeight": "700"
          }
        ],
        "headline-lg": [
          "32px",
          {
            "lineHeight": "1.2",
            "letterSpacing": "-0.01em",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "1.6",
            "fontWeight": "400"
          }
        ],
        "headline-lg-mobile": [
          "28px",
          {
            "lineHeight": "1.2",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "1.5",
            "fontWeight": "400"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "1",
            "letterSpacing": "0.05em",
            "fontWeight": "600"
          }
        ],
        "display-lg": [
          "48px",
          {
            "lineHeight": "1.1",
            "letterSpacing": "-0.02em",
            "fontWeight": "800"
          }
        ]
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
