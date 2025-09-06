# RevenueCat Webhook Server

This Next.js backend server handles RevenueCat webhooks, enabling seamless integration with your Firebase Firestore database. Easily deployable to Vercel for free, it provides functions to manage user credits, making it ideal for implementing custom credit systems tied to RevenueCat subscriptions.

This project is bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Revenuecat Subscriptions and Credit System | Implementing

Here’s how I combined RevenueCat subscriptions with usage-based credits without overcomplicating things (perfect for AI tools, AI wrappers API calls, or limiting features):

*   **Subscriptions via RevenueCat:** Users pick weekly/monthly/yearly plans. RevenueCat handles Apple/Google payments.
*   **Credit Tracking in Firestore:** We store credits in Firebase. Example: "Monthly plan = 1000 credits."
*   **Auto-Sync with Webhooks:** When someone subscribes/cancels, this custom RevenueCat Webhook Handler (built with Next.js and deployable on Vercel) updates Firestore. Credits auto-add/reset based on subscription events.
*   **Deduct Credits via Backend:** Every API call from the iOS app hits our backend → checks Firestore → subtracts credits.

**System Components:**

*   **iOS App:** Uses Firebase Auth and RevenueCat login linked via Firebase userID.
*   **Backend 1 (API):** Communicates with 3rd party services, deducts credits from the user’s Firestore record upon usage.
*   **Backend 2 (Webhook Handler - This Project):** Processes RevenueCat webhooks to add credits on new subscriptions, reset/add credits on renewals, and handle other subscription lifecycle events. All necessary event handlers are included.

If you are trying to implement a similar system, feel free to reach out. I am planning to publish this customizable Revenuecat Webhook handler server as a free open-source project, easily deployable on Vercel (free tier) for managing subscription and usage-based credit systems.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
