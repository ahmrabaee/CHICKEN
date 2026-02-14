# Blueprint 04 — Receivables & Payables Engine — Implementation Summary

**Status:** Phase 1–6 Implemented  
**Date:** February 2026

---

## Completed Phases

### Phase 1: Payment Ledger (PLE) Infrastructure ✅
- **Prisma models:** `PaymentLedgerEntry`, `PaymentAllocation`, `CreditNote`
- **PaymentLedgerService:** createPLE, createPLEForSale, createPLEForPaymentAgainstSale, createPLEForPurchase, createPLEForPaymentAgainstPurchase, delinkPLEForVoucher
- **OutstandingCalculatorService:** getSaleOutstanding, getPurchaseOutstanding, getPartyOutstanding

### Phase 2: PLE Creation on Transaction Submit ✅
- **Sales:** PLE created for invoice (sale) when customerId + totalAmount; PLE for each payment at creation
- **Payments (recordSalePayment):** PLE created when payment against sale
- **Purchases:** PLE created when purchase is received
- **Payments (recordPurchasePayment):** PLE created when payment against purchase
- **Void/Cancel:** delinkPLEForVoucher on sale void and payment cancel

### Phase 3: Outstanding from PLE ✅
- Outstanding = Invoice Total − Sum(Allocated) (derived, not stored)
- API: `GET /reconciliation/outstanding/sale/:id`
- API: `GET /reconciliation/outstanding/purchase/:id`
- API: `GET /reconciliation/outstanding/party?partyType=&partyId=`
- Migration script: `scripts/migrate-to-ple.ts`

---

## Files Added/Modified

| Path | Change |
|------|--------|
| `prisma/schema.prisma` | PaymentLedgerEntry, PaymentAllocation, CreditNote models; Branch.creditNotes, User.creditNotesCreated, Payment.allocations |
| `accounting/payment-ledger/*` | PaymentLedgerService, OutstandingCalculatorService, payment-ledger.module |
| `accounting/reconciliation/*` | ReconciliationController, reconciliation.module |
| `accounting/accounting.module.ts` | Import PaymentLedgerModule, ReconciliationModule |
| `sales/sales.service.ts` | Inject PaymentLedgerService; create PLE on sale; delink on void |
| `payments/payments.service.ts` | Inject PaymentLedgerService; create PLE on payment; delink on cancel |
| `purchases/purchases.service.ts` | Inject PaymentLedgerService; create PLE on receive |
| `scripts/migrate-to-ple.ts` | Backfill PLE from existing sales/purchases/payments |

---

## Migration

For existing data, run:
```bash
npx tsx scripts/migrate-to-ple.ts
```

---

### Phase 4: Reconciliation Tool ✅
- AllocationService, ReconciliationService, getOpenInvoices, getUnallocatedPayments, suggest, apply
- Advance payments: POST /payments/advance
- Frontend: /reconciliation

### Phase 5: Credit Notes ✅
- CreditNoteService: create, submit (GL + PLE)
- API: GET/POST /credit-notes, POST /credit-notes/:id/submit
- Frontend: /credit-notes

### Phase 6: Schema ✅
- Payment.referenceType/referenceId optional for advance
