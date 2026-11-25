# Posting Map — every money/stock operation (K3)

Source: code review of `app/backend/src` (HEAD as of 2026-11-24) + empirical probe on instance `k3` (dev profile)
(`.qa-audit/tests/K3/posting-probe*.mjs`, outputs `probe-output.txt`, `probe2-output.txt`). Finding IDs refer to `findings/K3.md`.

## 0. Ground rules of the posting layer

| Topic | Fact | Ref |
|---|---|---|
| Units | money = integer minor units (×100, currency label ₪/SAR inconsistent — see K2); weight = grams; price = minor units **per kg**; % = basis points | schema.prisma header; sales.service.ts:330 |
| Line value formula | `Math.round(weightGrams/1000 * pricePerKg)` per line (rounding per line, then summed) | sales.service.ts:330, purchases.service.ts:340 |
| Posting paths | `gl_engine_enabled` (default **false**) selects GL engine (`GlEngineService.post`) vs legacy `createJournalEntryInternal`. Both are built in every `create*JournalEntry` method; legacy is live. | accounting.service.ts:68, 522-546 |
| Legacy balance check | exact equality debit==credit else 400 UNBALANCED_ENTRY; also group/inactive/frozen account check and balanceMustBe check | accounting.service.ts:1088-1146 |
| GL engine balance check | tolerance 5 minor units for payment/JE/reversal, **50** for others; round-off line to company.roundOffAccountId (5400) — if null, posts unbalanced | gl-validator.service.ts, gl-rounding.service.ts |
| JE number | legacy: count+1 then probe for free number (safe after deletes); GL engine: count+1 (collides after deletes) | accounting.service.ts:1178; gl-entry.factory.ts:74 |
| JE date | legacy: always `new Date()` (document date ignored); GL engine: postingDate (sale uses saleDate, others now) | accounting.service.ts:1120 |
| isPosted | auto entries isPosted=true; manual JE (legacy) isPosted=false until POST /accounting/journal-entries/:id/post | |
| Party on lines | legacy path writes NO partyType/partyId/costCenter/companyId on lines; GL engine does | accounting.service.ts:1133 |
| Atomicity | every auto JE is created with the caller's `tx`; but account-ID resolution, group-posting checks, gl/tax flag reads, branch stock-account lookup, FIFO lot reads use `this.prisma` (outside tx, see K3-008) | |
| Period lock | `PeriodLockGuard.check` only in sale void, payment cancel, credit-note submit, allocation, reconciliation apply; settings `period_lock_enabled`/`accounting_freeze_date` absent by default ⇒ off | K3-018 |
| Reversal | `reverseByVoucher(type,id)` = mirror of the FIRST JE with that sourceType/sourceId, sourceType='reversal', sourceId=<original JE id>, original flagged isReversed | accounting.service.ts:1206-1260 |

### Account codes used by code (`ACCOUNT_CODES`, accounting.service.ts:19-45) vs seeded chart
| Constant | Code | Seed name | Note |
|---|---|---|---|
| CASH | 1111 | Cash in Drawer | leaf |
| BANK | 1112 | Cash in Bank | **group** (child 1112-001). Bank postings go to `bank_accounts.account_id` (seed: none; create one pointing to 1112-001) |
| ACCOUNTS_RECEIVABLE | 1120 | AR | |
| VAT_RECEIVABLE | 1125 | | only used via tax templates (GL+tax engine) |
| INVENTORY | 1131 | Fresh Chicken Inventory | default branch stock account; branch.stockAccountId overrides (StockAccountMapperService) |
| ACCOUNTS_PAYABLE | 2110 | AP | |
| VAT_PAYABLE | 2120 | | tax engine only |
| SALES_REVENUE | 4110 | Fresh Chicken Sales | all sales regardless of product (4120/4130 unused) |
| OTHER_INCOME | 4200 | Other Revenue | purchase credit notes |
| COST_OF_GOODS_SOLD | 5100 | COGS | |
| WASTAGE_EXPENSE | 5300 | Wastage & Spoilage | |
| INVENTORY_ADJUSTMENT | 5320 | Inventory Adjustment | both directions |
| OPERATING_EXPENSES | **5400** | Other Expenses | all expenses, category.accountCode ignored |
| DISCOUNTS_GIVEN | **5400** | Other Expenses | same account as expenses; seeded 4900 "Sales Discounts" unused |
| (round-off) | 5400 | | company.round_off_account_id = 5400 |

## 1. Operation table

Legend: Atomic = all writes inside one `$transaction` (Y), partly (P), no (N).

### 1.1 Sale — cash / bank / credit / partial / mixed / discount / tax
- Entry: `POST /v1/sales` → `SalesService.create` sales.service.ts:257 (retries 5× on sale_number P2002). Guard: JWT only (no role).
- Computation: per line gross = round(w/1000·price); lineTotal = gross − line.discountAmount; grossTotal = Σ lineTotal; totalDiscount = dto.discountAmount + round(grossTotal·discountPct/10000) (pct capped 500 bp for non-admin, hard-coded); subtotal = grossTotal − totalDiscount; if dto.taxTemplateId: tax = TaxCalculationService on subtotal (**regardless of tax_engine_enabled**); totalAmount = grandTotal = subtotal + tax. totalPayments = Σ dto.payments (reject > total+1). Credit/partial needs customerId or name+phone (auto-creates/links customer by phone).
- **JE (legacy, sourceType 'sale')** — accounting.service.ts:441-547:
  | Line | Account | Dr | Cr |
  |---|---|---|---|
  | if paid>0 | cash 1111 or bank GL of **payments[0]** method/bank | amountPaid | |
  | if due>0 | 1120 AR | totalAmount − amountPaid | |
  | revenue | 4110 | | totalAmount + totalDiscount (tax included!) |
  | if discount>0 | 5400 | totalDiscount | |
  | COGS | 5100 | totalCost (FIFO) | |
  | stock | branch stock acct (default 1131) | | totalCost |
  Line discounts are netted into revenue (not grossed up); only header discount is grossed up. Tax never reaches 2120 on the legacy path (K3-021). Mixed tender → all to first tender's account (**K3-003 VERIFIED**).
- GL engine variant: revenue = netTotal, receivable = grandTotal, + tax lines from template; discount line still added ⇒ unbalanced by discount (K3-020).
- Inventory: per line `allocateFIFO(itemId, grams)` — lots with remaining>0 ordered by receivedAt asc, cost = round(q/1000·lot.unitPurchasePrice) (inventory.service.ts:437). Writes: sale_line_cost_allocations (one per lot slice), inventoryLot.remaining −=, inventory.currentQuantityGrams −= w, inventory.totalValue −= lineCost, averageCost := totalValue·1000/qty, stock_movements (type 'sale', **branchId and lotId not set**), stock_ledger_entries (voucher 'sale', rate = lineCost·1000/w). Stock check uses inventory.currentQuantityGrams (vs item.allowNegativeStock; global setting ignored). FIFO reads outside tx and before earlier lines are decremented ⇒ double allocation (**K3-008 VERIFIED**: lot −10 kg).
- Subledger: payments rows (one per tender, PAY- count+1); PLE per payment (−amount, against sale) only if customerId; PLE for sale (+totalAmount) if customerId; Debt (receivable, totalAmount = **amountDue**, amountPaid 0) + customer.currentBalance += due if due>0 and customerId. Walk-in remainder ≤ 1 minor unit allowed without customer.
- Atomic: P (all writes in tx; FIFO + account lookups outside).
- Reversal: void (1.3).

### 1.2 Sale payment (after the sale)
Two different endpoints with different behaviour:
| | `POST /v1/payments/sale` → PaymentsService.recordSalePayment payments.service.ts:123 | `POST /v1/sales/:id/payments` → SalesService.addPayment sales.service.ts:861 |
|---|---|---|
| Guard | admin/accountant/cashier (RolesGuard) | JWT only |
| Payment row | yes (bankAccountId, branchId) | yes (no bank, no branch) |
| JE | 'payment': DR cash/bank(payment method) / CR 1120 | **NONE (K3-002 VERIFIED)** |
| sale.amountPaid/paymentStatus | yes | yes |
| Debt amountPaid / status | yes | yes |
| customer.currentBalance −= | yes | yes |
| PLE −amount against sale | yes (if customer) | yes (if customer) |
| Voided sale check | **none (K3-013 VERIFIED)** | none |
| Overpay check | outside tx | outside tx |

### 1.3 Sale void
- Entry: `POST /v1/sales/:id/void` (admin, RolesGuard) → voidSale sales.service.ts:682. Period lock checked on saleDate.
- Steps (in tx): for each non-voided payment referencing the sale: if it has its own 'payment' JE → reverseByVoucher('payment') ; delink its PLE; mark payment docstatus 2. Restore lots from cost allocations (+=), inventory qty/value += line cost (averageCost not recomputed), stock_movement 'void', SLE 'sale_void' (+). Delink sale PLE. Sale isVoided, docstatus 2. If customer & due>0: debts → 'written_off', customer.currentBalance −= (total − amountPaid). Audit log.
- JE 'sale_void' (legacy) = mirror of sale JE using **current** sale.amountPaid and sale.paymentMethod: CR cash/bank amountPaid; CR 1120 (total − amountPaid); DR 4110 total+discount; CR 5400 discount; CR 5100 cost; DR stock cost.
- **Defect K3-001 VERIFIED**: payments recorded later via /payments/sale are refunded twice (reversal + void JE) ⇒ cash −p, AR +p.
- Payments made via /sales/:id/payments (no JE) are refunded once by the void JE ⇒ GL ends consistent only by accident.
- Atomic: P (sale read & isVoided check outside tx ⇒ double-void race).

### 1.4 Credit note (sale or purchase)
- Entry: `POST /v1/credit-notes` (create draft, docstatus 0, CN- count+1) → `POST /v1/credit-notes/:id/submit` credit-note.service.ts:61. Guard: JWT only (Roles declared, not enforced).
- Validation: amount ≤ outstanding computed from PLE (outside tx).
- Sale CN JE 'credit_note': DR 5400 / CR 1120. PLE −amount against sale (if customer).
- Purchase CN JE 'credit_note': DR 2110 / CR 4200. PLE +amount against purchase.
- NOT done: inventory return/lots/SLE, COGS reversal, revenue/VAT reversal, sale/purchase amountPaid/paymentStatus, Debt, customer/supplier.currentBalance. No cancel operation. (K3-022)
- Atomic: P. "Return" of goods as such does not exist anywhere in the backend.

### 1.5 Purchase create (= immediate receipt)
- Entry: `POST /v1/purchases` (admin) → PurchasesService.create purchases.service.ts:321. Number PUR- count+1 **outside tx** (K3-005 VERIFIED collision after delete).
- totals: netTotal = Σ line; grandTotal = netTotal + dto.taxAmount; amountPaid = dto.amountPaid. receivedAt = now; **docstatus stays 0**.
- Inventory per line: inventory_lots (lotNumber LOT-yyyymmdd-count+1, branchId, unitPurchasePrice = pricePerKg, expiry = now + item.shelfLifeDays), inventory upsert (+qty, +value, averageCost recomputed — WAVG), stock_movement 'purchase', SLE 'purchase' (+lineTotal).
- Balance guard: if amountPaid>0 → assertSufficientBalance (cash/bank as of purchaseDate).
- JE 'purchase' (legacy): DR stock acct Σlines; CR cash/bank amountPaid; CR 2110 (Σlines − amountPaid) if >0. **Tax excluded** ⇒ GL AP short by tax; amountPaid > Σlines ⇒ UNBALANCED (K3-004 VERIFIED).
- Subledger if grandTotal − paid > 0: Debt (payable, totalAmount = **grandTotal**, amountPaid = paid — note: different semantics from sale debts), supplier.currentBalance += due, PLE −grandTotal; if partial also Payment row + PLE +paid. If fully paid: Payment row (no bankAccountId!) and no PLE/Debt.
- Atomic: P.

### 1.6 Purchase update / delete
- `PUT /v1/purchases/:id`, `DELETE /v1/purchases/:id` (admin). Allowed only if no active payments/credit notes and lots unused (no allocations, wastage, transfers, other movements).
- rollbackPurchaseDerivedData (purchases.service.ts:266): inventory −= qty/value, **hard delete** stock_movements, SLE, lots, purchase lines, journal_entries(source purchase), PLE, debts; supplier balance −= previous outstanding; (delete) purchase row deleted. Update then re-creates everything (amountPaid forced 0). No reversal JE, no audit, no period check (K3-006 VERIFIED).

### 1.7 Purchase receive
- `PUT /v1/purchases/:id/receive` → receive() :925. Only if receivedAt null — never true for API-created purchases (create sets it). Would create lots/SLE and a second purchase JE with `amountPaid=min(paid,received)` and no debt adjustment. Effectively dead code.

### 1.8 Purchase (supplier) payment
- `POST /v1/payments/purchase` (admin/accountant) → recordPurchasePayment payments.service.ts:231. Amount ≤ grandTotal − amountPaid (outside tx). assertSufficientBalance (current balance).
- Writes: Payment; purchase.amountPaid += , paymentStatus; Debt amountPaid += (or self-heal create Debt and supplier balance += still-due); JE 'payment': DR 2110 / CR cash/bank; PLE +amount against purchase.
- **supplier.currentBalance is NOT decremented** (K3-007 VERIFIED).

### 1.9 Expense payment (credit expense settled later)
- `recordExpensePayment` payments.service.ts:382 is **not exposed by any controller** (dead code) — credit expenses (Debt payable) can therefore never be settled through the API except by manual JE. Writes Payment, Debt, supplier balance −=, JE DR 2110 / CR cash/bank, PLE +amount against expense (there is never an expense invoice PLE).

### 1.10 Advance payment (customer receipt / supplier prepayment, unallocated)
- `POST /v1/payments/advance` → createAdvancePayment :687. Customer: JE DR cash/bank / CR 1120 (AR goes credit = customer advance inside AR, no separate liability), PLE −amount no against. Supplier: balance guard, JE DR 2110 / CR cash/bank, PLE +amount. customer/supplier.currentBalance NOT updated; no branchId.

### 1.11 Allocation / reconciliation
- `POST /v1/reconciliation/apply` → ReconciliationService.apply → AllocationService.allocate (in tx). PaymentAllocation upsert + PLE (for advance: offset PLE + against PLE). **No GL** (correct, cash already posted), but **no update** of sale/purchase amountPaid, Debt, balances (K3-023).

### 1.12 Payment cancellation
- `POST /v1/payments/:id/cancel` (admin/accountant) → cancelPayment :514. Period lock on paymentDate. reverseByVoucher('payment') — **fails with JOURNAL_ENTRY_NOT_FOUND for payments created inside sale/purchase creation or via /sales/:id/payments** (they have no own JE) — so those payments cannot be cancelled. Then delink PLE, payment docstatus 2; sale: amountPaid −=, status, debt amountPaid −=, customer balance += ; purchase: amountPaid −=, debt −= (**no supplier balance**); expense: debt −=, supplier balance +=. Allocations (payment_allocations) are not removed.

### 1.13 Debt write-off
- `POST /v1/debts/:id/write-off` (admin/accountant) → debts.service.ts:288. status 'written_off'; customer.currentBalance −= remaining (customer only). **No JE, no PLE, sale untouched** (K3-014 VERIFIED: AR Δ 0).

### 1.14 Expense
- `POST /v1/expenses` (PageAccess /expenses) → expenses.service.ts:56. EXP- count+1 outside tx. docstatus stays 0, isApproved false (approve is cosmetic, no posting effect).
- Balance guard unless paymentMethod 'credit' (as of expenseDate, on the **bank** account if bank_transfer).
- JE 'expense' (legacy): DR 5400 amount; CR **1111 cash** (even for bank_transfer/card — K3-011 VERIFIED) or CR 2110 if 'credit'. taxAmount ignored; category.accountCode ignored.
- credit: Debt payable (partyId may be null), supplier.currentBalance += if supplier. No PLE.
- Update `PUT /expenses/:id` / delete `DELETE /expenses/:id`: plain update/hard delete, JE & Debt untouched (K3-012 VERIFIED). Not atomic with GL at all.

### 1.15 Wastage
- `POST /v1/wastage` (JWT only) → wastage.service.ts:47. Requires lotId; value = round(g/1000·lot.unitPurchasePrice) (specific-lot cost).
- Writes (tx): lot remaining −=, inventory qty −=, value −= (averageCost not recomputed), wastage_record (docstatus 1), stock_movement 'wastage'. **No SLE** (K3-015 VERIFIED).
- JE 'wastage': DR 5300 / CR **1131 always** (ignores branch stock account); branchId on JE only if dto.branchId given.
- No void/cancel; approve is cosmetic.

### 1.16 Stock adjustment (+/−)
- `POST /v1/inventory/adjustments` (admin/accountant + page /inventory/adjustments) → inventory.service.ts:227. Item read outside tx.
- Decrease: value out = round(totalValue·q/currentQty) (**weighted average**), inventory qty/value/avg updated; **no lot touched** (K3-009 VERIFIED); movement 'adjustment_out' (lotId = dto.lotId if given, not decremented); SLE 'adjustment' (voucherId = movement id); JE 'adjustment': DR 5320 / CR stock acct.
- Increase: cost/kg = dto.unitCost or current average; value in = round(q/1000·cost); creates lot LOT-ADJ-… only if unitCost given (no branchId); JE DR stock / CR 5320.
- Unit cost required when current qty = 0.

### 1.17 Stock transfer (raw chicken → cuts; "تحويل المخزون")
- `POST /v1/stock-transfer` (admin/accountant) → stock-transfer.service.ts:133. Source lot read outside tx; Σ line weights ≤ source remaining.
- Creates transfer (status completed immediately), lines, one new lot per line at **user unitCost**, inventory upserts (+), movements, SLE 'transfer' (+ per line, − source at source lot cost), source lot remaining −= Σweights, source inventory −=.
- **No JE.** Value created/destroyed = Σ(line value) − source value, never posted (K3-016). No yield/bone loss concept (output weight = input weight). Branch-to-branch transfer does not exist.

### 1.18 Manual journal entry / reversal
- `POST /v1/accounting/journal-entries` (admin/accountant) → createJournalEntry :1374. Legacy: balanced check, group check (no balanceMustBe), isPosted false; `POST …/:id/post` sets isPosted. No period lock, no source document.
- `reverseJournalEntry` :1471 exists in service but **no controller route exposes it** (verified by grep); if wired up, nested $transaction and unposted reversal (K3-019).

### 1.19 Bank deposit / cash↔bank transfer, opening balances, period close
- **Do not exist** as operations. Only way: manual JE. No opening-balance import (stock, capital, AR/AP). AccountingPeriod rows are never created/closed by any service; balance sheet computes current-year net income on the fly (`getNetIncomeForPeriod`), no closing entries to 3200.

## 2. Cost method — what is actually in effect
- **Sales COGS: FIFO by lot** (`allocateFIFO`, ordered by `receivedAt` asc, NOT by expiry) recorded in `sale_line_cost_allocations` and `sale_lines.cost_per_kg/line_total_cost`; GL COGS = Σ allocations.
- **Wastage: specific lot cost** (user picks lot).
- **Adjustments: weighted average** of `inventory.totalValue / currentQuantityGrams`.
- **inventory.averageCost** (display, reports): weighted average recomputed after purchases/sales/transfers, not after wastage/void.
- **Stock transfer outputs: user-entered unit cost.**
- Setting `inventory.fifo_enabled` is never read. Swagger says FIFO; commit 75b3211 "weighted average" refers to the adjustment dialog/averageCost. Result: `inventory.total_value` ≠ Σ(lot remaining × lot price) ≠ GL 1131 after any adjustment/transfer.

## 3. Empirical check on the seeded dev DB (fresh copy, before any API call)
| Check | Result |
|---|---|
| journal_entries / lines | **0 / 0** — fixtures bypass posting (K2 bulletin) |
| Σdebit = Σcredit | trivially 0 = 0 |
| fixture sales | 5 × 10,000 paid, item 1 (CHK-RAW-01, no inventory row), total_cost 0, no cost allocations, no movements, no PLE |
| fixture purchases | 3 × 50,000 paid, received_at NULL, docstatus 1, no lots/JE |
| fixture payments | PAY-SEED-SAL-0001 cash 10000, PAY-SEED-PUR-0001 bank_transfer 50000 (no bank account exists), PAY-SEED-ADV-0001 1500 advance — no JE/PLE |
| fixture expenses | 3, payment_method NULL, no JE |
| inventory | items 2-6: 50 kg each, Σ value 560,000 = Σ lots; GL 1131 = 0 |
| customers/suppliers balances | all 0 |
| bank_accounts | none; users: admin only |

After the probe (API-created data): Σdebit = Σcredit = 524,208, **no unbalanced JE**, but: negative lot (item 6 −10 kg), inventory vs lots mismatch (item 5: 47 kg vs 52 kg), GL 1131 = −180,008 vs inventory.total_value 379,992 (seed stock without opening JE + K3-008/K3-009). The GL is internally balanced, yet wrong vs the subledgers — the dominant failure mode is *consistent-but-wrong* double entry, not unbalanced entries.

## 4. Cross-operation inconsistencies (summary)
1. Two sale-payment endpoints, one posts GL and one doesn't (K3-002).
2. Debt semantics differ: sale debt totalAmount = amount due; purchase debt totalAmount = grand total with amountPaid.
3. supplier.currentBalance: incremented by purchases/credit expenses, decremented by expense payments, never by purchase payments (K3-007).
4. Bank handling: sales/purchases/payments legacy path honours bankAccountId; expenses legacy path doesn't (K3-011); mixed tender ignores all but first (K3-003).
5. Stock account: sales/purchases/adjustments use branch stock account; wastage hard-codes 1131.
6. SLE written for sale, void, purchase, adjustment, transfer; not for wastage; deleted on purchase update/delete.
7. Tax: computed on sales even when tax engine off and booked as revenue; purchase tax only in subledger.
8. Document status: sales docstatus 1 on create; purchases & expenses remain 0 while posted.
9. Period lock applies to cancellations but not to creations or hard deletes.
