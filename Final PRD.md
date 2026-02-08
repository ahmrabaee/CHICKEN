# Butcher Shop Accounting & POS System – PRD

### TL;DR

A comprehensive accounting and point-of-sale (POS) system designed specifically for a small butcher shop (1–2 employees), prioritizing easy operation, detailed inventory tracking by batch and import date, customer debt management, returns, alerts, and fine-grained permissions between the shop owner (Admin) and cashier. The system supports all payment types, supplier management, inventory stock transfer between product types, and remote access from anywhere.

---

## Goals

### Business Goals

* Automate all butcher shop operations (sales, purchasing, inventory count) to reduce errors and save up to 80% of time.

* Increase accuracy of inventory and profit tracking, and reduce product loss by 95%.

* Enable the shop owner to monitor debts and collect them periodically, tracking all financial transactions.

* Provide weekly and monthly financial and inventory reports to support decision-making.

* Apply a permissions system to safeguard business owners’ confidential financial data.

### User Goals

* Fast completion of sales transactions, supporting all payment methods (cash, bank, credit, discounts).

* Reliable and transparent inventory tracking – knowing batch import and expiry dates for each lot.

* Ability for the owner to access and run the system from anywhere (shop/home) at any time.

* Customer management with easy debt creation, settlement, and stock transfers.

* Automatic alerts for soon-to-expire inventory and batches stored beyond a defined threshold.

### Non-Goals

* Integration with external accounting or POS systems.

* HR or payroll management outside current scope (only cashier and owner handled).

* Advanced multi-currency support (single currency only).

---

## User Stories

### Shop Owner (Admin)

* As the butcher shop owner, I want to monitor all sales, purchases, inventory, and debts so I can control every financial and operational detail.

* As the owner, I need to view detailed reports about profits, inventory, and debts to spot opportunities and waste.

* As the owner, I want to control cashier permissions so they cannot see supplier information or profit margins.

* As the owner, I can change my password and the cashier’s password as needed.

* As the owner, I want instant alerts about batches nearing expiry or spending too long in refrigerated storage.

### Cashier

* As a cashier, I want speedy sales transactions with payment by cash, bank, credit, or with applied discounts.

* As a cashier, I want to be able to add new customers or select them when a credit sale occurs, and log their debts.

* As a cashier, I need access to the customer list and their debts to register payment settlements.

* As a cashier, I want to record customer and supplier returns, with reasons and linkage to specific batches.

* As a cashier, I need to log new supplier deliveries and accurately update inventory data.

### Customer

* As a customer, I want to purchase meat and pay via multiple methods (cash/transfer/partial credit).

* As a customer, I want to be aware of my remaining (debt) balance if I buy on credit.

* As a customer, I want to return defective or non-conforming products and receive a clear return receipt.

---

## Functional Requirements

* **POS (High Priority)**

  * Sales interface: select products, input weight, apply discounts, choose payment type.

  * Link sales to a customer if the payment is on credit, and support partial payments.

  * Support for printing personalized receipts/invoices.

  * Product list with barcode and quick search support.

* **Inventory & Batch Management (High)**

  * Log new product batches with detailed info: receipt date, expiry, storage location.

  * Exact per-batch inventory tracking, disallowing sales above available quantity.

  * Auto-alerts for storage time exceeded or products near expiry.

* **Stock Transfer (High)**

  * Transfer from one product to another (e.g., whole chicken to chicken breasts), recording date, quantity, originating batch.

  * Stock transfer adjusts inventory values while preserving original batch date.

* **Customer & Debt Management (High)**

  * Add/edit customer profiles and support searching.

  * Record and settle customer debts, with detailed transaction reports.

  * Log new payments toward old customer debts.

* **Supplier & Purchase Management (High)**

  * Add/edit suppliers.

  * Log purchase transactions, linked to specific batches.

  * Record supplier payments: cash, deferred, or by cheque.

* **Returns (Medium)**

  * Register customer returns, connect to original invoice/batch.

  * Handle supplier returns specifying reason, batch, and returned quantity.

* **Permission System (High)**

  * Admin account: full permissions; Cashier: limited. Cashier cannot view profit, supplier prices, expenses, or detailed financial reports.

* **Branch Management (High)**

  * **Branch CRUD Operations:** Admin can create, view, edit, and deactivate branches.

  * **Branch Information:** Each branch includes code, name (Arabic/English), address, phone, and scale configuration.

  * **Main Branch:** During first-time setup, a main branch is automatically created. At least one branch must always be active.

  * **User-Branch Assignment:** Users are assigned to a default branch but can access data from other branches based on permissions.

  * **Inventory per Branch:** Track inventory levels separately for each branch location.

  * **Branch-Specific Reports:** Generate sales, inventory, and financial reports filtered by branch.

  * **Branch Permissions:** Admin can control which users have access to which branches.

* **Reports & Alerts (Medium)**

  * Periodic reports: sales, inventory, debts, profitability, bestsellers, spoilage.

  * Automatic alerts for batches expiring or in storage for too long.

* **User Management (High)**

  * **First-Time Setup:** At first login, the stakeholder selects a business name, an admin username, and an admin password.

  * **Admin Dashboard:** After logging in, admins are taken to the admin dashboard where they can add and manage users.

  * **Add User Interface:** Admin can add new users with the following required information:
    * Full name
    * Username
    * Password
    * User role (admin or cashier)
    * Default branch (selectable from available branches)
    * Preferred language (Arabic or English)

  * **Users Page:** The system includes a dedicated Users page that lists all users with the following details:
    * Name
    * Username
    * Role
    * Assigned branch
    * Status (active/inactive)
    * Last appearance or last login
    * Login status (logged in or not)
    * Work start date (date added to the system)

  * **Password Management:** Interface for changing any user password (admin can reset cashier passwords).

  * **User Account Management:** Full CRUD operations for user accounts with role-based access control.

---

## User Experience Flow

**Entry Point & First-Time Experience**

* **Initial Setup (First Login):**

  * When accessing the system for the first time, the stakeholder is prompted to complete the initial setup.

  * The setup wizard requests:
    * Business name
    * Admin username
    * Admin password

  * After completing the setup, the admin is automatically logged in and taken to the admin dashboard.

* **Subsequent Logins:**

  * Users (cashier or owner) access via a desktop app built on Tauri with a clear login screen.

  * Login screen asks for username/password, with "change password" link so when it is clicked it will give an alert to login as an admin (if the user was a cashier).

  * System supports multi-language login (Arabic/English based on user's preferred language setting).

* **Admin Dashboard:**

  * After login, admins can immediately access user management features.

  * The dashboard prominently displays the "Add User" and "Users" options.

  * Onboarding message highlights key system features on first login.

* **User Profile Management:**

  * Each user can update their profile (name, preferred language) or change their password.

  * Admins have full control over all user accounts.

**Core Experience**

* **Main interface adjusts based on account role:**

  * *Admin*: Full dashboard access (sales, inventory, customers, debts, suppliers, expenses, reports, settings, permissions).

  * *Cashier*: Access to sales page, customers & debts, purchase intake, and returns.

* **Conducting a Sale:**

  * Select product (barcode or search), shows available quantity per batch.

  * Enter weight/quantity.

  * Enter discount if needed, choose payment method (cash, bank, credit, partial).

  * If on credit or partial: popup to select/add customer.

  * Complete transaction: logs sale to relevant batch, deducts inventory, prints receipt, updates dashboard.

* **Customer & Debt Management:**

  * Customer list with summary (total debt, last payment, phone).

  * Clicking a customer: view debt details, register new payment installment.

* **Inventory & Batch Intake:**

  * Interface to log new deliveries with all details (supplier, date, product, qty, storage location).

  * Display all batches sorted by date, with remaining quantity for each batch.

* **Stock Transfer:**

  * Select source batch (e.g., whole chicken), input transfer qty, select new product (e.g., chicken breasts), log transfer with all details.

* **Returns:**

  * Register customer or supplier returns, with return reason and link to original invoice/batch.

* **Reports & Alerts:**

  * Reports page with categories (sales, profits, inventory, debts).

  * Alerts page showing critical notifications (expiring batches, overdue debts, etc.).

**Advanced Features & Edge Cases**

* Reset cashier password only by the admin.

* Return value calculated automatically by purchase/sale price.

* In offline-server scenarios (frontend works locally): show alert and sync pending transactions on reconnect.

* If attempting to sell unavailable or expired inventory, show error and block transaction.

**UI/UX Highlights**

* Clear colors (green for success, red for warnings, gray for secondary).

* Simple, touch-friendly UIs for non-technical users.

* Full Arabic RTL language support.

* Large, readable fonts for all ages.

* Export reports to PDF/Excel, print-ready.

* Fast interactions, minimal loading, and easy-to-read progress indicators.

---

## Narrative

Ahmad, a local butcher shop owner, manages customers, meat purchases from suppliers, and monitoring his fridge inventory every day. Previously, Ahmad kept handwritten ledgers for quantities, batches, and customer debts, but often lost oversight—old batches spoil, customer debts go uncollected, and product status becomes unclear.

With the new system, all sales and purchases are automated. Every new batch is logged precisely with supplier, date, quantity, and storage location, and Ahmad receives automatic alerts when inventory is nearing expiry. The cashier quickly logs sales, enters the paid amount, and any remaining balance is automatically recorded as customer debt. Ahmad can now view daily sales and profit reports from anywhere without being physically present and can manage both his password and the cashier’s. He now spends more time growing his business, worrying less about losses from human error.

---

## Success Metrics

### User-Centric Metrics

* Number of daily/weekly active users.

* Percentage of sales completed without manual intervention or errors.

* Owner satisfaction (surveyed).

### Business Metrics

* Monthly profit increases.

* Reduction in inventory losses.

* Faster debt collection rates.

### Technical Metrics

* API response time under 1.5 seconds for any transaction.

* System uptime above 99%.

* Error rate below 1% of total operations.

### Tracking Plan

* Sales transactions (payment type, invoice value, discounts).

* User logins/logouts.

* New inventory batches logged.

* Customer debt payments.

* Inventory stock transfers.

* All returns or alerts triggered or viewed.

---

## Technical Considerations

### Technical Stack

* **Front-end:** Desktop app using Tauri + React. Supports local operation.

* **Back-end:** Central server using NestJS, with full business logic and REST APIs.

* **Database:** SQLite with Prisma ORM for robust, secure data management.

* **Permissions:** JWT or secure sessions for user and role management.

* **Alerts:** Internal notification system; local storage for connectivity status, batch uploads on reconnection.

### Integration Points

* Sync between server time and real-time notification system (optionally via sockets).

* Barcode support (future: attach barcode scanner device to frontend).

* Export reports as PDF/Excel (no external integration needed).

### Data Storage & Privacy

* All users and permissions stored in encrypted form.

* No data shared with third parties.

* Regular server-side automated backups.

* Follow best security practices: password management, login/logout logs.

### Scalability & Performance

* Designed for a single-shop installation but can handle up to 2,000 product SKUs.

* System robust up to three concurrent users with no performance degradation.

* Local/server sync designed for reliability and low latency.

### Potential Challenges

* Managing network interruptions between frontend (local) and backend (server)—sync and retry.

* Securing data in case the main local device is lost or stolen (encryption).

* Protecting system from weak password choices (enforce strong security policies).

---

## Database Schema (Prisma ORM)

### Main Tables

* **User**

  * id, username, passwordHash, role (enum: admin, cashier), active, lastLogin

* **Customer**

  * id, name, phone, address, note, createdAt, updatedAt

* **Supplier**

  * id, name, phone, address, note

* **ProductCategory**

  * id, name, active

* **Product**

  * id, name, categoryId (fk), unit, barcode, active, minStock

* **StockBatch**

  * id, productId (fk), supplierId (fk), batchNumber, receivedAt, expiryAt, storageLocation, initialQty, currentQty, costPerUnit, status (enum: normal, expired, returned, transferred), note

* **StockTransfer**

  * id, fromBatchId (fk), toProductId (fk), quantity, transferredAt, note

* **PurchaseOrder**

  * id, supplierId (fk), createdAt, totalAmount, paidAmount, paymentMethod (enum: cash, cheque, credit), note, status

* **Sale**

  * id, cashierId (fk), customerId (fk nullable), saleTime, totalAmount, paidAmount, discount, paymentMethod (enum: cash, bank, credit), note

* **SaleItem**

  * id, saleId (fk), productId (fk), batchId (fk), quantity, pricePerUnit

* **Payment**

  * id, fromType (enum: customer/supplier), fromId (fk), toType (enum: supplier/customer), toId (fk), paymentDate, amount, paymentMethod, note

* **CustomerDebt**

  * id, customerId (fk), saleId (fk), totalDebt, paidAmount, status (enum: open, closed), createdAt, dueDate

* **Return**

  * id, type (enum: customer, supplier), referenceId (sale/purchase order id), batchId (fk), productId (fk), quantity, reason, returnTime

* **Expense**

  * id, description, amount, expenseDate, createdBy (fk)

* **Setting**

  * id, key, value, updatedAt

Key Relationships

* Every sale is linked to a cashier/customer and to sale items/debts.

* Every stock batch is received from a supplier and connects to a specific product.

* Payments can originate from or go to either customer or supplier, depending on scenario.

* Returns are linked to a customer/supplier, batch, and invoice/purchase ID as reference.

---

## Milestones & Sequencing

### Project Estimate

* Size: 6–8 weeks (from start to release).

### Team Size & Composition

* Small team: 2–3 people (Backend Engineer, Frontend Engineer, Product/QA—roles can be shared).

### Suggested Development Phases

**Phase 1 – Authentication & Core Setup (Weeks 1–2)**

* Key Deliverables: Initial DB schema, user/account models, login/change-password UI, core API, first app build.

* Dependencies: Complete database and environment setup.

**Phase 2 – POS & Inventory (Weeks 3–4)**

* Key Deliverables: Complete POS, batch entry, inventory operations, basic returns, sales flows, linking products and inventory.

* Dependencies: Inventory core tables finalized.

**Phase 3 – Suppliers & Debts (Weeks 5–6)**

* Key Deliverables: Supplier management, purchase logging, supplier/debt payments, detailed debt reporting, robust customer management.

* Dependencies: Sales and purchasing flows finished.

**Phase 4 – Reports & Polish (Weeks 7–8)**

* Key Deliverables: Final UI/reporting (profits, debts, top sellers, alerts), user experience improvements, final testing, user documentation.

* Dependencies: All core operational data in place.

---