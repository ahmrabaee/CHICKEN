# Business Requirements Document (BRD)
## Integrated POS, Accounting & Inventory System  
### Chicken Retail Shop (محل دجاج / فروج)

---

## 1. Introduction

### Purpose of the Document
This document defines the complete business requirements for a unified software system designed specifically for chicken retail shops (محلات دجاج / فروج). It serves as a reference for owners, developers, and stakeholders.

### Project Overview
The system combines Point of Sale (نقطة البيع – POS), accounting, inventory management, supplier & customer tracking, and daily operations into one integrated desktop/web application tailored for high-volume poultry shops in Arab countries.

### Business Objectives
- Speed up daily sales and reduce cashier errors  
- Track weight-based inventory accurately  
- Control waste, shrinkage, and daily losses  
- Monitor profits, expenses, and cash flow  
- Reduce manual bookkeeping  

### Scope

**In Scope**
- POS sales by weight and fixed price  
- Inventory & stock management  
- Purchases & suppliers  
- Accounting & finance  
- Customers & credit sales  
- Employees & simple payroll  
- Reports & analytics  

**Out of Scope**
- Online delivery platforms  
- Advanced HR systems  
- Government tax filing  

### Target Users
- Owner / Manager  
- Cashier / Seller  
- Storekeeper / Purchaser  
- Accountant (optional)  

---

## 2. Stakeholders & User Roles

### Owner / Manager
- Full system access  
- Reports, profits, approvals  

### Cashier / Seller
- POS operations  
- Daily sales and receipts  

### Purchaser / Store Manager
- Inventory and suppliers  
- Purchase recording  

### Accountant (Optional)
- Accounting and reports  

---

## 3. Functional Requirements

### 3.1 Point of Sale (POS)

- Fast, touch-friendly billing screen  
- Arabic-first interface  
- Quick buttons for common items (فروج كامل، صدور، أفخاذ…)  
- Barcode scanning + manual search  

#### Weight-Based Selling
- Digital scale integration  
- Live weight reading (kg)  
- Automatic price calculation  

#### Pricing Types
- Per kg  
- Per piece  
- Fixed price items  

#### Discounts
- Percentage or fixed amount  
- Customer-based discounts  
- Manager approval for manual discounts  

#### Payments
- Cash  
- Debit / Credit card  
- Mobile payment (optional)  
- Credit / on-account (آجل)  

#### Receipts
- Thermal printer support  
- Arabic receipt (English optional)  

#### Returns & Closing
- Void or return sale with reason  
- End-of-day cash closing and Z report  

---

### 3.2 Inventory & Stock Management

- Categorized items: fresh, cut, frozen, cooked, extras  
- Stock tracking by kg and quantity  
- Daily fresh stock opening & closing  
- Multiple locations (fridge, freezer, display)  

#### Waste & Shrinkage
- Spoilage, trimming loss, leftovers  
- Mandatory reason entry  
- Affects profit calculations  

#### Alerts
- Low stock alerts  
- Expiry alerts for frozen items  

---

### 3.3 Purchases & Suppliers

- Supplier profiles and balances  
- Purchase invoices  
- Goods receiving with weight check  
- Auto inventory update  

#### Live Bird Tracking
- Gross live weight  
- Net usable meat  
- Shrinkage percentage  
- Real cost per kg  

---

### 3.4 Accounting & Finance

- Automatic journal entries from POS and purchases  
- Expense tracking (rent, electricity, gas, salaries…)  
- Cash flow tracking  
- Debtors (customers) & creditors (suppliers)  

#### Financial Reports
- Daily profit  
- Monthly profit & loss  
- Cash summary  

---

### 3.5 Customers

- Customer name & phone  
- Credit limit  
- Outstanding balance  
- Payment history  
- Simple loyalty or discounts  

---

### 3.6 Employees & Payroll (Simple)

- Employee list  
- Attendance  
- Fixed or daily wages  
- Salary advances  
- Optional sales commission  

---

### 3.7 Reports & Analytics

- Daily sales by item and cashier  
- Best / worst selling items  
- Profit per item (after waste)  
- Inventory status  
- Supplier purchase history  
- Cashier performance  

Export formats:
- PDF  
- Excel  

---

## 4. Non-Functional Requirements

- Full Arabic interface (RTL), English optional  
- Fast performance with 500+ items  
- User login & role-based permissions  
- Touchscreen optimized  
- Hardware support:
  - Thermal printer  
  - Barcode scanner  
  - Cash drawer  
  - Digital weighing scale  
- Windows desktop preferred  
- Offline mode required  
- Local database + optional cloud backup  

---

## 5. Assumptions, Constraints & Risks

### Assumptions
- Cash-heavy business  
- Single shop initially  

### Constraints
- Hardware compatibility  
- Internet instability  

### Risks
- Wrong scale calibration  
- Poor waste recording  
- User resistance  

---

## 6. Data Model / Key Entities

- Items  
- Categories  
- Inventory batches  
- Transactions  
- Suppliers  
- Customers  
- Employees  
- Payments  
- Expenses  
- Reports  

---

## 7. Use Cases / User Stories

1. As a cashier, I want to weigh chicken and sell by kg quickly.  
2. As an owner, I want daily profit including waste.  
3. As a storekeeper, I want to record live bird purchases.  
4. As a cashier, I want to sell on credit to regular customers.  
5. As a manager, I want low-stock alerts.  
6. As an accountant, I want monthly profit reports.  

---

## 8. Glossary

- **Whole Chicken (فروج كامل)**: Entire fresh chicken  
- **Cut-up (تقطيع)**: Chicken parts  
- **Shrinkage (هدر)**: Loss after cleaning/cutting  
- **POS**: Point of Sale  
- **Credit Sale (آجل)**: Pay later  
- **Waste**: Unsellable loss  

---

**End of Document**
