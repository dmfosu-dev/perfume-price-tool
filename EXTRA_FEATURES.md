# Perfume Price & Inventory Tool — Feature Expansion Pack

This document outlines supplementary features for the admin dashboard and intermediary workflow, building upon the core v1 specifications[cite: 1]. These additions focus on financial strategy, mobile usability, and data enrichment.

## 1. Financial Projections & Strategy (Admin Only)

*   **Landed Cost & Margin Simulator:** Calculates the true break-even point by layering estimated shipping and customs costs onto the raw SAR price[cite: 1]. The admin can input a target profit margin to automatically generate a suggested retail price in USD, GHS, or AED[cite: 1].
*   **Capital Restock Forecaster:** Allows the admin to select a batch of out-of-stock SKUs[cite: 1] and input desired restock quantities. Calculates the total capital required in SAR and converts it to fiat using the active FX source (XE, Wise, or manual)[cite: 1].
*   **Exchange Rate Stress Testing:** Enables "What-If" scenarios where the admin can manually tweak FX rates independently of live API fetches[cite: 1] to simulate how currency fluctuations impact the profitability of the existing catalog.
*   **Competitor Benchmarking:** A manual tracking view where the admin logs local retail competitor prices for a given variant. The system compares the landed cost against competitor pricing to highlight the most lucrative arbitrage opportunities.
*   **Price Volatility Scoring:** Analyzes the append-only `PriceHistory` log[cite: 1] to flag highly volatile perfumes. This helps the admin identify which items to buy in bulk during price dips and which stable items to buy on-demand.

## 2. Intermediary Workflow Enhancements (Mobile-First)

*   **"Bounty" or Urgent Request Flags:** The admin can flag specific SKUs for a priority check. These items are pinned to the top of the intermediary's dashboard[cite: 1] with distinct styling, ensuring they are checked first in the wholesale market.
*   **Barcode (UPC/EAN) Scanning:** Leverages the mobile device's camera to scan physical boxes in the shop, instantly pulling up the exact SKU to bypass manual text search and prevent data entry errors.
*   **One-Tap "Verify Price" Button:** Allows the intermediary to clear the "stale price" visual flag (>14 days)[cite: 1] with a single tap if the market price hasn't changed. This refreshes the `last_updated_at` timestamp[cite: 1] without cluttering the primary history log.
*   **Discrepancy Reporting Workflow:** Expands the basic admin flag[cite: 1] into a dedicated "Report Discrepancy" button on the SKU view. Intermediaries can quickly type a note (e.g., volume differences or naming errors) that routes directly to an admin review queue.
*   **Receipt / Quote Image Capture:** Allows the intermediary to snap a photo of a physical receipt or a vendor's written quote. This image attaches directly to the `PriceHistory` log[cite: 1] to verify exceptionally low or contested prices.

## 3. Procurement Details

*   **Vendor / Market Location Tagging:** An optional field for the intermediary to log *where* they found a specific SAR price. This allows the admin to filter historical data[cite: 1] to determine which specific wholesale markets consistently yield the best margins.
*   **Volume Pricing (MOQ) Tiers:** Adds an optional `minimum_order_quantity` field next to the price input. Captures heavily discounted wholesale prices that require purchasing by the carton rather than the individual bottle.
*   **Local Inventory Sync (Admin Side):** A manual input for current local stock levels—kept entirely separate from customer order handling[cite: 1]. The admin can filter the dashboard to only show items that are "Out of Stock Locally" AND "In Stock in KSA"[cite: 1] to generate optimized shopping lists.

## 4. System Operations

*   **Bulk CSV Import:** Complements the planned CSV export feature[cite: 1]. Allows the admin to rapidly upload new brands, variants, and SKUs via a spreadsheet template, dramatically speeding up the onboarding of new inventory.