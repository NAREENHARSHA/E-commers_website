# ShopFlow — Full-Stack E-Commerce Platform

A production-ready e-commerce web application built with **Node.js, Express, and MongoDB** — featuring a customer-facing shop SPA and a comprehensive admin dashboard with real-time analytics.

---

##  Features

### Customer Portal
- JWT-based authentication (register/login via phone or email)
- Dynamic product catalog with category filtering & search
- Shopping cart with quantity management & stock validation
- Order placement with COD / UPI / Bank payment options
- Order history with live status tracking
- Discount & courier charge visibility on receipts

### Admin Dashboard
- Secure role-based admin login
- Product CRUD with Cloudinary image upload
- Order management — status updates, per-item discount, courier charge
- Customer directory with full order history
- Thermal receipt generation (80mm, print-ready)

### Analytics & Reporting
- Monthly revenue bar chart (Canvas API)
- Category-wise sales with drill-down view
- Item-wise sales breakdown with date tracking
- Purchase price management (per product, per month)
- Profit/loss calculation with Excel (CSV) export

---

##  Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JSON Web Tokens (JWT) + bcryptjs |
| File Storage | Cloudinary |
| Frontend | Vanilla JS — Single Page Application (no framework) |
| Deployment | Render.com |

---

##  Project Structure

```
shopflow/
├── backend/
│   ├── models/
│   │   ├── Customer.js        # Customer schema with password hashing
│   │   ├── Product.js         # Product schema with Cloudinary image
│   │   └── Order.js           # Order schema with discount & courier
│   ├── routes/
│   │   ├── auth.js            # Admin + customer authentication
│   │   ├── products.js        # Product CRUD + Cloudinary upload
│   │   └── orders.js          # Order management + analytics API
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── server.js              # Express entry point
│   └── package.json
└── frontend/
    ├── index.html             # Customer SPA
    ├── admin.html             # Admin dashboard SPA
    └── js/
        └── main.js            # Customer-side JS
```

---

##  Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/shopflow.git
cd shopflow
```

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Configure environment variables
Create a `.env` file in the `backend/` folder:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/shopflow
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Run the server
```bash
npm start
```

- Shop: `http://localhost:5000`
- Admin: `http://localhost:5000/admin`

---

##  API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Admin login |
| POST | `/api/auth/register` | — | Customer registration |
| POST | `/api/auth/customer/login` | — | Customer login |
| GET | `/api/products` | — | List products |
| POST | `/api/products` | Admin | Add product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| POST | `/api/orders` | Customer | Place order |
| GET | `/api/orders/my` | Customer | My orders |
| GET | `/api/orders` | Admin | All orders |
| PUT | `/api/orders/:id/status` | Admin | Update status |
| PUT | `/api/orders/:id/amount` | Admin | Edit amount/discount/courier |
| GET | `/api/orders/customers` | Admin | Customer list |

---

##  Key Implementation Details

- **SPA without framework** — full frontend in vanilla JS, no React/Vue/Angular
- **Dynamic categories** — categories auto-generated from product data
- **Per-month profit tracking** — purchase prices stored per product per month for accurate historical reporting
- **Proportional discount** — order discount distributed proportionally across items in revenue reports
- **Dual-role JWT** — single middleware handles both admin and customer tokens via `role` field
- **Cloudinary integration** — images uploaded via multer memory storage, streamed to Cloudinary
- **Thermal receipt** — 80mm print-ready bills with itemized breakdown, discount, and courier charge

---

##  License

MIT License — free to use for learning and portfolio purposes.
