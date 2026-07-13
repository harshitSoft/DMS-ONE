# DMS - Dealer Management System

Production-ready MERN-style Dealer Management System using React, Express, Node.js and MySQL with Sequelize.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS + Axios + React Router
- Backend: Node.js + Express + Sequelize + MySQL
- Auth: JWT + bcrypt
- Roles: `SUPER_ADMIN`, `ADMIN`, `DEALER`

## Setup

1. Create the database:

```sql
CREATE DATABASE IF NOT EXISTS dms_db;
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Seed database:

```bash
npm run seed
```

To create or refresh only the default Super Admin without resetting existing data:

```bash
npm run seed:super-admin
```

4. Start backend:

```bash
npm run dev
```

5. Install and start frontend:

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on Vite ports such as `http://localhost:5173` or `http://localhost:5174`. Backend runs on `http://localhost:5000`.

The backend CORS policy allows:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:5175`

## Demo Accounts

Super Admin Login:

- email: `harshit.nigam@itsoftlab.com`
- password: `harshit123`

Other demo accounts:

- TVS Admin: `admin@tvs.com` / `admin123`
- TVS Dealer: `dealer@tvs.com` / `dealer123`

## Environment

Backend `.env`:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Ram1234
DB_NAME=dms_db
DB_PORT=3306
JWT_SECRET=dms_super_secret_key
JWT_EXPIRES_IN=7d
```

## API Documentation

All protected routes require `Authorization: Bearer <token>`.

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Super Admin

- `GET /api/super-admin/dashboard`
- `GET /api/super-admin/companies`
- `POST /api/super-admin/companies`
- `GET /api/super-admin/companies/:id`
- `PUT /api/super-admin/companies/:id`
- `PATCH /api/super-admin/companies/:id/status`
- `DELETE /api/super-admin/companies/:id`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/dashboard/analytics`
- `GET /api/admin/company`
- `GET|POST /api/admin/dealers`
- `PUT|DELETE /api/admin/dealers/:id`
- `GET /api/admin/products`
- `POST /api/admin/products` multipart form-data with optional `image`
- `PATCH /api/admin/inventory/:productId`
- `GET /api/admin/stock/company`
- `GET /api/admin/stock/dealers`
- `GET /api/admin/orders`
- `GET /api/admin/orders/pending`
- `POST /api/admin/orders/:id/approve-with-schedule`
- `PATCH /api/admin/orders/:id/status`
- `GET|POST /api/admin/payments`
- `GET /api/admin/finance/approved-orders`
- `POST /api/admin/finance/send-payment-request/:orderId` multipart form-data with optional `invoice`
- `GET /api/admin/finance/payments`
- `GET|POST /api/admin/policies`
- `GET|POST /api/admin/messages`
- `GET /api/admin/messages/conversations`
- `POST /api/admin/messages/send`
- `PUT /api/admin/messages/read/:conversationId`
- `GET /api/admin/reports`

### Dealer

- `GET /api/dealer/dashboard`
- `GET /api/dealer/stock`
- `GET|POST /api/dealer/orders`
- `GET /api/dealer/inventory`
- `PATCH /api/dealer/inventory/:id`
- `GET /api/dealer/finance`
- `GET /api/dealer/finance/payments`
- `POST /api/dealer/finance/pay/:paymentId`
- `GET /api/dealer/policies`
- `GET /api/dealer/messages`
- `GET /api/dealer/messages/conversation`
- `POST /api/dealer/messages/reply`
- `POST /api/dealer/reports`

### Compatibility API Paths

The project also exposes the requested short paths:

- `POST /api/products`
- `GET /api/products`
- `GET /api/finance/admin/approved-orders`
- `POST /api/finance/admin/send-payment-request/:orderId`
- `GET /api/finance/admin/payments`
- `GET /api/finance/dealer/payments`
- `POST /api/finance/dealer/pay/:paymentId`
- `GET /api/messages/admin/conversations`
- `GET /api/messages/dealer/conversation`
- `POST /api/messages/admin/send`
- `POST /api/messages/dealer/reply`
- `PUT /api/messages/read/:conversationId`

## Order Flow

Admin uploads stock. Dealer places an order and the order starts as `pending`.

Before approval, Admin must set:

- `packingDate`
- `shippingDate`
- `outForDeliveryDate`
- `deliveredDate`

`POST /api/admin/orders/:id/approve-with-schedule` validates all dates, checks stock, deducts company stock, marks the order `approved`, stores `approvedAt` and `approvedBy`, and creates planned delivery tracking entries. The planned dates do not automatically mark the order delivered. Admin can still manually update actual delivery status later.

## Finance Flow

After an order is approved, it appears in Admin Finance under approved orders waiting for payment request. Admin can upload an invoice file and click **Send Payment Request**. This creates a pending payment record tied to the order and dealer.

Dealer Finance shows pending payable requests with order number, products, amount, invoice link, and payment status.

Dealer payment options:

- Online Payment: dummy flow, generates a fake transaction id, marks payment as paid.
- Cash Payment: confirmation flow, marks payment as paid with method `cash`.

Successful payments store method, `paidAt`, `paidBy`, and transaction id when online. Admin Finance shows pending/paid, cash/online counts, total pending/paid amount, dealer-wise payments, invoice links, and payment update messages.

## Uploads

Product images are uploaded with Multer to:

```text
backend/uploads/products
```

Invoice files are uploaded to:

```text
backend/uploads/invoices
```

The backend serves uploaded files at:

```text
http://localhost:5000/uploads/...
```

## Messages

Admin can send messages to one dealer or all dealers. Dealer can reply. Conversations use normal protected HTTP APIs, no sockets or WebSocket. Messages store `conversationId`, `dealerId`, sender/receiver fields, timestamp, and read state.

Scheduled delivery messages also appear in the same chat history as system order updates. The `messages` table stores:

- `messageType`: `manual` or `system_order_update`
- `orderNumber` for order-related system messages

## Scheduled Delivery Messages

When Admin approves an order with delivery dates, the backend creates records in `order_scheduled_messages`:

- `approval`
- `packing`
- `shipping`
- `out_for_delivery`
- `delivered`

The approval message is sent immediately:

```text
Your order #{orderNumber} has been approved. Your expected delivery date is {deliveredDate}.
```

The remaining messages are sent once on their planned date:

```text
Your order #{orderNumber} packing has started today.
Your order #{orderNumber} has been shipped today.
Your order #{orderNumber} is out for delivery today.
Your order #{orderNumber} is scheduled to be delivered today.
```

The backend uses `node-cron` to run a daily local-date checker at `00:05`. It also runs once on server startup. The checker sends rows where `scheduledDate` is today and `isSent = false`, then marks them sent with `sentAt`. A unique index on `orderId + messageType` plus the `isSent` flag prevents duplicates across restarts or repeated job runs.

## Admin Dashboard Analytics

`GET /api/admin/dashboard/analytics` returns company-scoped analytics only for the logged-in Admin:

- Summary cards for dealers, products, stock, orders, payments, revenue, and pending amount
- Order status counts
- Inventory analytics with highest stock, low stock, and dealer-wise stock
- Finance analytics with paid/pending/cash/online totals and outstanding payment by dealer
- Dealer analytics with active/blocked dealers, area-wise counts, and top dealers
- Recent orders, payments, messages, and delivery updates

The frontend uses `recharts` for chart sections and `lucide-react` icons for dashboard cards.

## Finance Status Badges

Finance status UI uses badge colors:

- Paid: green
- Pending: yellow
- Failed/rejected: red
- Cash: neutral badge
- Online: cyan badge

## Database Updates

The backend includes a safe startup migration helper. Missing columns are added if needed and skipped if they already exist:

- `products.image`
- `orders.packingDate`, `shippingDate`, `outForDeliveryDate`, `deliveredDate`, `approvedAt`, `approvedBy`
- `payments.invoiceFile`, `paymentRequestSentAt`, `paidAt`, `paidBy`, `approvedBy`
- `messages.isRead`, `conversationId`, `messageType`, `orderNumber`
- `order_scheduled_messages` table for scheduled delivery notifications

## New Packages

- Backend: `node-cron`
- Frontend: `recharts`
