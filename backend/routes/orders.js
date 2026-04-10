const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Product = require('../models/Product');
const auth    = require('../middleware/auth');
const jwt     = require('jsonwebtoken');

// POST place order (public)
router.post('/', async (req, res) => {
  try {
    const { customer, items, paymentMethod, notes, deliveryAddress } = req.body;
    const cust = customer || {};
    if (deliveryAddress && !cust.address) cust.address = deliveryAddress;
    if (!cust?.name || !cust?.phone || !cust?.address)
      return res.status(400).json({ success: false, message: 'Customer name, phone and address required' });
    if (!items || !items.length)
      return res.status(400).json({ success: false, message: 'Order must have at least one item' });

    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive)
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
      if (product.stock < item.quantity)
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      orderItems.push({ product: product._id, name: product.name, price: product.price, quantity: item.quantity, image: product.image, category: product.category });
      totalAmount += product.price * item.quantity;
      product.stock -= item.quantity;
      await product.save();
    }

    const order = new Order({ customer: cust, items: orderItems, totalAmount, paymentMethod: paymentMethod || 'cod', notes: notes || '' });
    await order.save();
    res.status(201).json({ success: true, message: 'Order placed!', orderId: order.orderId, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET customer's own orders (JWT)
router.get('/my', async (req, res) => {
  try {
    const { phone } = req.query;
    let orders;
    if (phone) {
      orders = await Order.find({ 'customer.phone': phone }).sort({ createdAt: -1 });
    } else {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(400).json({ success: false, message: 'Auth required' });
      const decoded  = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
      const Customer = require('../models/Customer');
      const customer = await Customer.findById(decoded.id);
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
      orders = await Order.find({ 'customer.phone': customer.phone }).sort({ createdAt: -1 });
    }
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET all orders (admin)
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 9999 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * parseInt(limit)).limit(Math.min(parseInt(limit), 9999));
    const total  = await Order.countDocuments(filter);
    res.json({ success: true, orders, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET dashboard stats (admin)
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const totalOrders   = await Order.countDocuments();
    const newOrders     = await Order.countDocuments({ status: 'new' });
    const totalProducts = await Product.countDocuments({ isActive: true });
    const revenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    res.json({ success: true, stats: { totalOrders, newOrders, totalRevenue: revenue[0]?.total || 0, totalProducts } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT update status (admin)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (status === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT update amount/discount/courier (admin)
router.put('/:id/amount', auth, async (req, res) => {
  try {
    const { totalAmount, discount, originalAmount, discountReason, discountedItem, courierCharge } = req.body;
    if (totalAmount === undefined || totalAmount < 0)
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { totalAmount, discount: discount||0, originalAmount: originalAmount||totalAmount, discountReason: discountReason||'', discountedItem: discountedItem||'', courierCharge: courierCharge||0 } },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET all customers (admin)
router.get('/customers', auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const map = {};
    for (const o of orders) {
      const phone = o.customer?.phone;
      if (!phone) continue;
      if (!map[phone]) map[phone] = { name: o.customer.name, phone, address: o.customer.address, orders: 0, totalSpent: 0, lastOrder: o.createdAt };
      map[phone].orders++;
      if (o.status !== 'cancelled') map[phone].totalSpent += o.totalAmount;
      if (o.createdAt > map[phone].lastOrder) map[phone].lastOrder = o.createdAt;
    }
    res.json({ success: true, customers: Object.values(map) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET orders by customer phone (admin)
router.get('/customers/:phone', auth, async (req, res) => {
  try {
    const orders = await Order.find({ 'customer.phone': req.params.phone }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
