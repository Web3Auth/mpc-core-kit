import type { Config } from "tailwindcss";
import tailwindCssVariables from "@mertasan/tailwindcss-variables";
import containerQueries from "@tailwindcss/container-queries";
import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    colors: {
      transparent: colors.transparent,
      app: {
        onPrimary: "var(--app-on-primary)",
        primary: {
          900: "var(--app-primary-900)",
          800: "var(--app-primary-800)",
          700: "var(--app-primary-700)",
          600: "var(--app-primary-600)",
          500: "var(--app-primary-500)",
          400: "var(--app-primary-400)",
          300: "var(--app-primary-300)",
          200: "var(--app-primary-200)",
          100: "var(--app-primary-100)",
          50: "var(--app-primary-50)",
        },
        gray: {
          900: "var(--app-gray-900)",
          800: "var(--app-gray-800)",
          700: "var(--app-gray-700)",
          600: "var(--app-gray-600)",
          500: "var(--app-gray-500)",
          400: "var(--app-gray-400)",
          300: "var(--app-gray-300)",
          200: "var(--app-gray-200)",
          100: "var(--app-gray-100)",
          50: "var(--app-gray-50)",
        },
        blue: {
          900: "var(--app-blue-900)",
          800: "var(--app-blue-800)",
          700: "var(--app-blue-700)",
          600: "var(--app-blue-600)",
          500: "var(--app-blue-500)",
          400: "var(--app-blue-400)",
          300: "var(--app-blue-300)",
          200: "var(--app-blue-200)",
          100: "var(--app-blue-100)",
          50: "var(--app-blue-50)",
        },
        light: {
          "surface-main": "var(--app-gray-100)",
          surface1: "var(--app-white)",
          surface2: "var(--app-gray-50)",
          surface3: "var(--app-gray-100)",
          surface4: "var(--app-gray-200)",
        },
        dark: {
          "surface-main": "var(--app-gray-900)",
          surface1: "var(--app-black)",
          surface2: "var(--app-gray-900)",
          surface3: "var(--app-gray-800)",
          surface4: "var(--app-gray-700)",
        },
        success: "var(--app-success)",
        warning: "var(--app-warning)",
        error: "var(--app-error)",
        info: "var(--app-info)",
        white: "var(--app-white)",
        black: "var(--app-black)",
        alertDark: "var(--app-alertDark)",
        blueBorder: "var(--app-blueBorder)",
      },
    },
    extend: {
      transitionProperty: {
        height: "height",
        spacing: "margin, padding",
      },
      transformOrigin: {
        top: "top",
      },
      scale: {
        "0": "0",
        "100": "1",
      },
      opacity: {
        "0": "0",
        "100": "1",
      },
      fontSize: {
        "2xs": "0.7rem",
      },
      fontFamily: {
        primary: ["Inter", ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.75)" },
          "100%": { transform: "scale(1)" },
        },
        scaleOut: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(0.75)" },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out forwards",
        fadeOut: "fadeOut 0.3s ease-out forwards",
        scaleIn: "scaleIn 0.3s ease-out forwards",
        scaleOut: "scaleOut 0.3s ease-out forwards",
        spin: "spin 1s linear infinite",
      },
      variables: {
        DEFAULT: {
          app: {
            "on-primary": "#ffffff",
            primary: {
              900: "#233876",
              800: "#1e429f",
              700: "#1a56db",
              600: "#0346ff",
              500: "#3f83f8",
              400: "#76a9fa",
              300: "#a4cafe",
              200: "#c3ddfd",
              100: "#e1effe",
              50: "#ebf5ff",
            },
            gray: {
              900: "#111928",
              800: "#1f2a37",
              700: "#374151",
              600: "#4b5563",
              500: "#6b7280",
              400: "#9ca3af",
              300: "#d1d5db",
              200: "#e5e7eb",
              100: "#f3f4f6",
              50: "#f9fafb",
            },
            blue: {
              900: "#233876",
              800: "#1e429f",
              700: "#1a56db",
              600: "#0346ff",
              500: "#3f83f8",
              400: "#76a9fa",
              300: "#a4cafe",
              200: "#c3ddfd",
              100: "#e1effe",
              50: "#ebf5ff",
            },
            success: "#30cca4",
            warning: "#fbc94a",
            error: "#fb4a61",
            info: "#d4d4d4",
            white: "#ffffff",
            black: "#000000",
            alertDark: "#041E42",
            blueBorder: "#15285D",
          },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    tailwindCssVariables,
    containerQueries,
  ],
  darkMode: "class",
} as Config;
