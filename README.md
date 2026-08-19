# Forge

> A modern personal finance management application built to help users track accounts, transactions, budgets, bills, credit cards, EMIs, loans, invoices, and financial goals in one place.

![Forge Dashboard](./public/dashboard-preview.png)

## Overview

**Forge** is a full-featured personal finance management platform designed around accurate financial tracking and clear separation between different types of accounts and financial operations.

The application supports everything from everyday income and expenses to more complex financial workflows such as:

- Credit card limits and outstanding balances
- Credit card EMI conversion and pre-closure
- Credit card statements and billing cycles
- Loan accounts, disbursement, repayment schedules, and pre-closure
- Recurring bills and upcoming payments
- Budget and category-based spending analysis
- Invoice tracking
- Savings goals
- Secure user-level data isolation

Forge is built with a focus on **correct accounting behavior, data consistency, validation, and financial integrity**.

---

# ✨ Features

## 📊 Dashboard

A centralized financial overview providing:

- Total balance across eligible accounts
- Monthly income
- Monthly expenses
- Cash flow visualization
- Spending breakdown by category
- Budget usage and remaining budget
- Recent transactions
- Invoice summary
- Upcoming payments and EMI payments in a combined widget
- Quick navigation to relevant sections

### Upcoming Widget

Upcoming Bills and EMI Payments are presented inside a single widget with tab-based navigation.

- **Payments** tab
- **EMI Payments** tab

This keeps related upcoming financial obligations in one place without duplicating underlying logic.

---

# 💳 Account Management

Forge supports multiple account types:

- 🏦 Bank
- 💵 Cash
- 💳 Credit Card
- 🏠 Loan
- 📈 Investment
- 🏦 Fixed Deposit

Each account type follows its own financial behavior and validation rules.

---

## Bank & Cash Accounts

Supports:

- Opening balance
- Income tracking
- Expense tracking
- Transfers
- Insufficient funds protection

Balance calculation:

```text
Opening Balance
+ Income
- Expenses
- Outgoing Transfers
+ Incoming Transfers