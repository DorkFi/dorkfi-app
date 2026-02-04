# Welcome to DorkFi Borrow Lend Protocol

## Project info

**URL**: https://lovable.dev/projects/453684e9-f8bf-459b-9196-e4f9c0e5b52c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/453684e9-f8bf-459b-9196-e4f9c0e5b52c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Number formatting and locale (i18n)

Numeric display and input support both **decimal-point** (e.g. 1,234.56) and **decimal-comma** (e.g. 1.234,56 or 1 234,56) locales. The user can choose:

- **Auto**: use the browser locale (`navigator.language`); fallback is `en-US`.
- **Manual**: pick a BCP-47 locale (e.g. en-US, de-DE, fr-FR) from the header globe control.

**Using the utility**

- **Formatting**: use `formatNumber`, `formatCurrency`, or `formatPercent` from `@/utils/numberI18n` (or the locale-aware wrappers in `@/utils/formatting`). In React, use the `useNumberI18n()` hook from `@/contexts/LocaleSettingsContext` so displayed numbers follow the current locale.
- **Parsing user input**: use `parseNumber(inputString)` from `@/utils/numberI18n` (or re-exported from `@/utils/formatting`). It returns `number | null`; invalid or ambiguous input returns `null`. Store canonical numeric values internally (e.g. JS numbers with "." as decimal).
- **Inputs**: use the `LocaleNumberInput` component (`@/components/ui/LocaleNumberInput`) for numeric fields; it displays with locale formatting and parses on blur with inline validation.

**Adding new locales**

1. Add the BCP-47 locale string to `SUPPORTED_MANUAL_LOCALES` in `src/utils/localeSettings.ts`.
2. Add a label in `MANUAL_LOCALE_LABELS` in `src/components/LocaleNumberSettings.tsx`.
3. Formatting and parsing use `Intl.NumberFormat` and locale-derived decimal/grouping separators, so no further changes are needed for standard locales.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/453684e9-f8bf-459b-9196-e4f9c0e5b52c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
