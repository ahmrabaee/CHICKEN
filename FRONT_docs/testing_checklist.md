
# 🧪 Testing Guide: Groups 1, 2 & 3

Please follow this checklist to verify the integration. You can use the browser to perform these actions.

## 🔐 Group 1: Authentication & Setup
- [ ] **Initial Setup**: If the system is fresh, navigate to `/setup`. Does the wizard work?
- [ ] **Login**: Login with your admin credentials.
- [ ] **Logout**: Click logout. Are you redirected to `/login`?
- [ ] **Persistence**: Refresh the page while logged in. Do you remain logged in?
- [ ] **Password Change**: Go to Settings, change your password. Verify you need to login again.

## 👥 Group 2: User Management
- [ ] **Active Sessions**: Go to the **Users** page. Can you see the "Active Sessions" card with a count?
- [ ] **Create User**: Add a new user (e.g., a "Cashier"). Verify they appear in the list.
- [ ] **Reset Password**: Click the "Key" icon/menu item on a user. Try resetting their password.
- [ ] **Toggle Status**: Deactivate a user and verify their status badge changes to "Inactive".

## 📦 Group 3: Inventory Management
- [ ] **Category CRUD**: Go to Inventory settings or category list (if visible). Add a new category.
- [ ] **Item CRUD**: Add a new item. Verify it appears with the correct unit and prices.
- [ ] **Stock Adjustment**: 
    - Click "Adjustment" (تسوية) on an item.
    - Add 10 units. Verify the total quantity updates.
    - Subtract 5 units. Verify FIFO logic works (backend should handle this).
- [ ] **Stock Transfer**:
    - Click "Transfer" (تحويل) on an item like "Whole Chicken".
    - Select a target item like "Chicken Breast".
    - Execute transfer and verify both items' quantities update.
- [ ] **Search & Filter**: Test the search bar and the "Low Stock" filter.

---

> [!IMPORTANT]
> If you see any red toast messages (destructive) or 404/500 errors in the console, please let me know the exact error message!
