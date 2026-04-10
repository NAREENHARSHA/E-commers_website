/* ── ShopFlow Customer JS ── */
const API = '/api';
let products      = [];
let categories    = [];
let cart          = JSON.parse(localStorage.getItem('sf_cart') || '[]');
let customerToken = localStorage.getItem('sf_ctoken') || null;
let customerData  = JSON.parse(localStorage.getItem('sf_cdata') || 'null');

/* ══ AUTH ══════════════════════════════════════════════════════ */
function openAuth(mode) {
  mode = mode || 'login';
  document.getElementById('form-login').style.display    = mode === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('auth-overlay').classList.add('open');
}
function closeAuth() { document.getElementById('auth-overlay').classList.remove('open'); }
function switchAuth(mode) {
  document.getElementById('form-login').style.display    = mode === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('li-err').style.display = 'none';
  document.getElementById('rg-err').style.display = 'none';
}
document.getElementById('auth-overlay').addEventListener('click', function(e) { if (e.target === this) closeAuth(); });

async function doLogin() {
  var email = document.getElementById('li-email').value.trim();
  var pass  = document.getElementById('li-pass').value;
  var err   = document.getElementById('li-err');
  var btn   = document.getElementById('li-btn');
  if (!email || !pass) { showErr(err, 'Enter phone/email and password'); return; }
  btn.textContent = 'Logging in...'; btn.disabled = true;
  try {
    var cleaned = email.replace(/[\s+\-()]/g, '');
    var isPhone = /^\d{7,15}$/.test(cleaned);
    var body    = isPhone ? {phone: email, password: pass} : {email: email, password: pass};
    var res  = await fetch(API + '/auth/customer/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    var data = await res.json();
    if (!data.success) throw new Error(data.message);
    saveSession(data.token, data.customer);
    closeAuth(); renderHeader();
    showToast('👋', 'Welcome, ' + data.customer.name + '!');
  } catch(e) { showErr(err, e.message); }
  finally { btn.textContent = 'Login'; btn.disabled = false; }
}

async function doRegister() {
  var name  = document.getElementById('rg-name').value.trim();
  var phone = document.getElementById('rg-phone').value.trim();
  var email = document.getElementById('rg-email').value.trim();
  var pass  = document.getElementById('rg-pass').value;
  var addr  = document.getElementById('rg-addr').value.trim();
  var err   = document.getElementById('rg-err');
  var btn   = document.getElementById('rg-btn');
  if (!name || !phone || !pass) { showErr(err, 'Name, phone and password required'); return; }
  if (pass.length < 6) { showErr(err, 'Password min 6 characters'); return; }
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    var res  = await fetch(API + '/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, phone, email, password: pass, address: addr})});
    var data = await res.json();
    if (!data.success) throw new Error(data.message);
    saveSession(data.token, data.customer);
    closeAuth(); renderHeader();
    showToast('🎉', 'Welcome, ' + data.customer.name + '!');
  } catch(e) { showErr(err, e.message); }
  finally { btn.textContent = 'Create Account'; btn.disabled = false; }
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function saveSession(token, cust) {
  customerToken = token; customerData = cust;
  localStorage.setItem('sf_ctoken', token);
  localStorage.setItem('sf_cdata', JSON.stringify(cust));
}
function logout() {
  customerToken = null; customerData = null;
  localStorage.removeItem('sf_ctoken'); localStorage.removeItem('sf_cdata');
  cart = []; localStorage.removeItem('sf_cart');
  renderHeader(); updateBadge(); showPage('shop');
  showToast('👋', 'Logged out!');
}
function renderHeader() {
  var pill = document.getElementById('user-pill');
  if (customerToken && customerData) {
    var first = customerData.name ? customerData.name.split(' ')[0] : 'User';
    pill.innerHTML = '<span class="user-name">👤 ' + first + '</span><button onclick="logout()">Logout</button>';
  } else {
    pill.innerHTML = '<button onclick="openAuth(\'login\')">Login / Sign Up</button>';
  }
}

/* ══ NAVIGATION ════════════════════════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  var btn = document.querySelector('[data-page="' + name + '"]');
  if (btn) btn.classList.add('active');
  document.getElementById('hero-wrap').style.display = name === 'shop' ? 'block' : 'none';
  if (name === 'cart')   renderCart();
  if (name === 'orders') loadMyOrders();
  if (name === 'shop')   loadProducts();
  window.scrollTo({top: 0, behavior: 'smooth'});
  document.getElementById('mob-nav').classList.remove('open');
}
document.querySelectorAll('[data-page]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var pg = btn.dataset.page;
    if ((pg === 'orders' || pg === 'cart') && !customerToken) { openAuth('login'); return; }
    showPage(pg);
  });
});
document.getElementById('ham').addEventListener('click', function() {
  document.getElementById('mob-nav').classList.toggle('open');
});

/* ══ PRODUCTS ══════════════════════════════════════════════════ */
function imgUrl(image) {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return '/uploads/' + image;
}

async function loadProducts() {
  var search = (document.getElementById('srch')    || {value:''}).value || '';
  var cat    = (document.getElementById('cat-sel') || {value:''}).value || '';
  var sort   = (document.getElementById('sort-sel')|| {value:''}).value || '';
  var grid   = document.getElementById('prod-grid');
  grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="ei">⏳</div><h3>Loading...</h3></div>';
  try {
    var url = API + '/products?';
    if (search) url += 'search=' + encodeURIComponent(search) + '&';
    if (cat)    url += 'category=' + encodeURIComponent(cat) + '&';
    var res  = await fetch(url);
    var text = await res.text();
    var data;
    try { data = JSON.parse(text); } catch(e) { throw new Error('Server error. Please try again.'); }
    if (!data.success) throw new Error(data.message || 'Failed to load products');
    products = data.products || [];
    if (sort === 'asc')  products.sort(function(a,b){ return a.price - b.price; });
    if (sort === 'desc') products.sort(function(a,b){ return b.price - a.price; });

    // Build dynamic category list
    var cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    var catSel = document.getElementById('cat-sel');
    var curCat = catSel.value;
    catSel.innerHTML = '<option value="">All Categories</option>';
    cats.forEach(c => { catSel.innerHTML += '<option value="'+c+'" '+(c===curCat?'selected':'')+'>'+c.charAt(0).toUpperCase()+c.slice(1)+'</option>'; });

    // Build hero cat buttons
    var catBar = document.getElementById('cat-bar');
    catBar.innerHTML = '<button class="cat-btn '+(cat===''?'active':'')+'" onclick="filterCat(\'\')">All</button>';
    cats.forEach(c => {
      catBar.innerHTML += '<button class="cat-btn '+(cat===c?'active':'')+'" onclick="filterCat(\''+c+'\')">'+c.charAt(0).toUpperCase()+c.slice(1)+'</button>';
    });

    renderProds();
  } catch(err) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="ei">⚠️</div><h3>Could not load products</h3><p>' + err.message + '</p></div>';
  }
}

function filterCat(cat) {
  var sel = document.getElementById('cat-sel');
  if (sel) sel.value = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  showPage('shop');
}

function renderProds() {
  var grid = document.getElementById('prod-grid');
  if (!products.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="ei">🔍</div><h3>No products found</h3></div>';
    return;
  }
  grid.innerHTML = products.map(function(p) {
    var inCart = cart.find(function(c){ return c._id === p._id; });
    var stkCls = p.stock === 0 ? 'out' : p.stock < 10 ? 'low' : 'in';
    var stkLbl = p.stock === 0 ? 'Out of Stock' : p.stock < 10 ? 'Only ' + p.stock + ' left' : 'In Stock';
    var img    = imgUrl(p.image);
    var cat    = p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1) : 'Product';
    return '<div class="prod-card">'
      + '<div class="prod-img">'
      + (img ? '<img src="'+img+'" alt="'+p.name+'" loading="lazy"/>' : '<div class="no-img">🛍</div>')
      + '<span class="cat-tag">'+cat+'</span>'
      + '<span class="stk-tag '+stkCls+'">'+stkLbl+'</span>'
      + '</div><div class="prod-body">'
      + '<div class="prod-name">'+p.name+'</div>'
      + '<div class="prod-desc">'+(p.description || 'Quality product.')+'</div>'
      + '<div class="prod-price">₹'+p.price.toLocaleString('en-IN')+' <span class="prod-unit">'+(p.unit||'')+'</span></div>'
      + '<div class="prod-actions">'
      + '<button class="btn-add" onclick="addToCart(\''+p._id+'\')" '+(p.stock===0?'disabled':'')+'>'
      + (inCart ? '✓ In Cart (' + inCart.qty + ')' : '+ Add to Cart') + '</button>'
      + '<button class="btn-eye" onclick="quickView(\''+p._id+'\')">👁</button>'
      + '</div></div></div>';
  }).join('');
}

function quickView(id) {
  var p = products.find(function(x){ return x._id === id; }); if (!p) return;
  var inCart = cart.find(function(c){ return c._id === id; });
  var img = imgUrl(p.image);
  var stkCls = p.stock===0?'out':p.stock<10?'low':'in';
  var stkLbl = p.stock===0?'Out of Stock':p.stock<10?'Only '+p.stock+' left':'In Stock ('+p.stock+')';
  document.getElementById('success-box').innerHTML =
    '<button class="modal-close" onclick="closeSuccess()">✕</button>'
    +'<div style="border-radius:12px;overflow:hidden;height:200px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">'
    +(img?'<img src="'+img+'" style="width:100%;height:100%;object-fit:cover"/>':'<div style="font-size:5rem">🛍</div>')
    +'</div>'
    +'<h3 style="font-family:\'Playfair Display\',serif;font-size:1.5rem;color:var(--primary);margin-bottom:.5rem">'+p.name+'</h3>'
    +'<p style="color:var(--muted);font-size:.88rem;line-height:1.6;margin-bottom:1rem">'+(p.description||'Quality product.')+'</p>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;background:#f8f8f8;padding:.9rem 1rem;border-radius:10px;margin-bottom:1rem">'
    +'<div class="prod-price" style="font-size:1.5rem">₹'+p.price.toLocaleString('en-IN')+'<span class="prod-unit"> '+(p.unit||'')+'</span></div>'
    +'<span class="stk-tag '+stkCls+'" style="position:static">'+stkLbl+'</span>'
    +'</div>'
    +'<button class="btn-add" style="width:100%;padding:.8rem" onclick="addToCart(\''+p._id+'\');closeSuccess()" '+(p.stock===0?'disabled':'')+'>'
    +(inCart?'✓ Already in Cart ('+inCart.qty+')':'+ Add to Cart')+'</button>';
  document.getElementById('success-overlay').classList.add('open');
}

/* ══ CART ══════════════════════════════════════════════════════ */
function addToCart(id) {
  if (!customerToken) { openAuth('login'); return; }
  var p = products.find(function(x){ return x._id === id; });
  if (!p || p.stock === 0) return;
  var ex = cart.find(function(c){ return c._id === id; });
  if (ex) { if (ex.qty < p.stock) ex.qty++; else { showToast('⚠️', 'Max stock: '+p.stock); return; } }
  else cart.push({_id:p._id, name:p.name, price:p.price, qty:1, image:p.image, category:p.category, unit:p.unit||''});
  saveCart(); renderProds();
  showToast('🛒', p.name + ' added!');
}
function removeItem(id) { cart = cart.filter(function(c){ return c._id !== id; }); saveCart(); renderCart(); renderProds(); }
function changeQty(id, d) {
  var item = cart.find(function(c){ return c._id === id; });
  var prod = products.find(function(p){ return p._id === id; });
  if (!item) return;
  item.qty = Math.max(1, Math.min(prod ? prod.stock : 99, item.qty + d));
  saveCart(); renderCart();
}
function saveCart() { localStorage.setItem('sf_cart', JSON.stringify(cart)); updateBadge(); }
function updateBadge() {
  var n = cart.reduce(function(s,i){ return s+i.qty; }, 0);
  document.getElementById('cbadge').textContent   = n;
  document.getElementById('cbadge-m').textContent = n;
}
function cartTotal() { return cart.reduce(function(s,i){ return s+i.price*i.qty; }, 0); }

function renderCart() {
  var div = document.getElementById('cart-wrap');
  if (!cart.length) {
    div.innerHTML = '<div class="empty"><div class="ei">🛒</div><h3>Cart is empty</h3><br/><button class="btn-primary" onclick="showPage(\'shop\')" style="width:auto;padding:.6rem 1.5rem">Shop Now</button></div>';
    return;
  }
  var items = cart.map(function(item) {
    return '<div class="cart-item">'
      +'<div class="ci-img">'+(item.image?'<img src="'+imgUrl(item.image)+'" alt="'+item.name+'"/>':'🛍')+'</div>'
      +'<div class="ci-info"><h4>'+item.name+'</h4>'
      +'<div class="ci-cat">'+item.category+' · '+item.unit+'</div>'
      +'<div class="qty-row"><button class="qbtn" onclick="changeQty(\''+item._id+'\',-1)">−</button><span class="qnum">'+item.qty+'</span><button class="qbtn" onclick="changeQty(\''+item._id+'\',1)">+</button></div>'
      +'</div>'
      +'<div class="ci-right"><div class="ci-price">₹'+(item.price*item.qty).toLocaleString('en-IN')+'</div>'
      +'<button class="btn-rm" onclick="removeItem(\''+item._id+'\')">🗑</button></div></div>';
  }).join('');
  var total = cartTotal().toLocaleString('en-IN');
  var addr  = customerData && customerData.address ? customerData.address : '';
  div.innerHTML = '<div class="cart-grid"><div>'+items+'</div>'
    +'<div class="o-summary"><h3>Order Summary</h3>'
    +cart.map(function(i){ return '<div class="sum-row"><span>'+i.name+' ×'+i.qty+'</span><span>₹'+(i.price*i.qty).toLocaleString('en-IN')+'</span></div>'; }).join('')
    +'<div class="sum-row tot"><span>Total</span><span>₹'+total+'</span></div>'
    +'<div class="chk-form">'
    +'<label>Delivery Address *</label>'
    +'<textarea id="c-addr" rows="3" placeholder="Full delivery address...">'+addr+'</textarea>'
    +'<label>Payment Method</label>'
    +'<select id="c-pay"><option value="cod">Cash on Delivery</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option></select>'
    +'<label>Notes (optional)</label>'
    +'<textarea id="c-notes" rows="2" placeholder="Any special requests..."></textarea>'
    +'<button class="btn-place" id="place-btn" onclick="placeOrder()">Place Order — ₹'+total+'</button>'
    +'</div></div></div>';
}

/* ══ PLACE ORDER ═══════════════════════════════════════════════ */
async function placeOrder() {
  if (!customerToken) { openAuth('login'); return; }
  var addr  = (document.getElementById('c-addr') || {value:''}).value.trim();
  var pay   = (document.getElementById('c-pay')  || {value:'cod'}).value;
  var notes = (document.getElementById('c-notes')|| {value:''}).value.trim();
  if (!addr) { showToast('⚠️', 'Please enter delivery address'); return; }
  if (!customerData || !customerData.name) {
    try {
      var vr = await fetch(API+'/auth/verify', {headers:{Authorization:'Bearer '+customerToken}});
      var vd = await vr.json();
      if (vd.success && vd.customer) { customerData = vd.customer; localStorage.setItem('sf_cdata', JSON.stringify(vd.customer)); }
    } catch(e) {}
  }
  var btn = document.getElementById('place-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing order...'; }
  try {
    var res = await fetch(API+'/orders', {
      method: 'POST',
      headers: {'Content-Type':'application/json', Authorization:'Bearer '+customerToken},
      body: JSON.stringify({
        items: cart.map(function(i){ return {productId:i._id, quantity:i.qty}; }),
        paymentMethod: pay, notes: notes, deliveryAddress: addr,
        customer: {name:(customerData&&customerData.name)||'Customer', phone:(customerData&&customerData.phone)||'', address:addr}
      })
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.message);
    cart = []; saveCart();
    var o = data.order;
    document.getElementById('success-box').innerHTML =
      '<div style="text-align:center">'
      +'<div style="font-size:3rem;margin-bottom:.75rem">🎉</div>'
      +'<h3 style="font-family:\'Playfair Display\',serif;font-size:1.6rem;color:var(--primary);margin-bottom:.5rem">Order Placed!</h3>'
      +'<p style="color:var(--muted);font-size:.88rem;margin-bottom:1rem">Thank you <strong>'+(o.customer&&o.customer.name||'')+'</strong>! We will process your order shortly.</p>'
      +'<div class="o-box">'
      +'<p><strong>Order ID:</strong> '+o.orderId+'</p>'
      +o.items.map(function(i){ return '<p>• '+i.name+' ×'+i.quantity+' — ₹'+(i.price*i.quantity).toLocaleString('en-IN')+'</p>'; }).join('')
      +'<p style="margin-top:.5rem"><strong>Total: ₹'+o.totalAmount.toLocaleString('en-IN')+'</strong></p>'
      +'<p><strong>Payment:</strong> '+(pay==='cod'?'Cash on Delivery':pay.toUpperCase())+'</p>'
      +'</div>'
      +'<div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.25rem;flex-wrap:wrap">'
      +'<button class="btn-primary" style="width:auto;padding:.6rem 1.25rem" onclick="closeSuccess();showPage(\'shop\')">Continue Shopping</button>'
      +'<button class="btn-outline" onclick="closeSuccess();showPage(\'orders\')">My Orders</button>'
      +'</div></div>';
    document.getElementById('success-overlay').classList.add('open');
  } catch(err) {
    showToast('❌', err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Place Order — ₹'+cartTotal().toLocaleString('en-IN'); }
  }
}

/* ══ MY ORDERS ═════════════════════════════════════════════════ */
async function loadMyOrders() {
  var div = document.getElementById('orders-wrap');
  if (!customerToken) {
    div.innerHTML = '<div class="empty"><div class="ei">🔒</div><h3>Login to view orders</h3><br/><button class="btn-primary" style="width:auto;padding:.6rem 1.25rem" onclick="openAuth(\'login\')">Login</button></div>';
    return;
  }
  div.innerHTML = '<div class="empty"><div class="ei">⏳</div><h3>Loading orders...</h3></div>';
  try {
    var res  = await fetch(API+'/orders/my', {headers:{Authorization:'Bearer '+customerToken}});
    var data = await res.json();
    if (!data.success) throw new Error(data.message);
    if (!data.orders.length) {
      div.innerHTML = '<div class="empty"><div class="ei">📦</div><h3>No orders yet</h3><br/><button class="btn-primary" style="width:auto;padding:.6rem 1.25rem" onclick="showPage(\'shop\')">Shop Now</button></div>';
      return;
    }
    div.innerHTML = '<div class="orders-list">'+data.orders.map(function(o) {
      var discount = o.discount || 0;
      var courier  = o.courierCharge || 0;
      return '<div class="ord-card">'
        +'<div class="ord-top"><div><div class="ord-id">'+o.orderId+'</div>'
        +'<div class="ord-date">📅 '+new Date(o.createdAt).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})+'</div></div>'
        +'<span class="spill '+o.status+'">'+o.status+'</span></div>'
        +'<div class="ord-items">'+o.items.map(function(i){ return '<span class="ord-chip">'+i.name+' ×'+i.quantity+'</span>'; }).join('')+'</div>'
        +(discount>0?'<div style="font-size:.78rem;color:#16a34a;margin-bottom:.4rem">Discount: -₹'+discount+(o.discountedItem?' on '+o.discountedItem:'')+'</div>':'')
        +(courier>0?'<div style="font-size:.78rem;color:#d97706;margin-bottom:.4rem">Courier: +₹'+courier+'</div>':'')
        +'<div class="ord-foot"><div class="ord-total">₹'+o.totalAmount.toLocaleString('en-IN')+'</div>'
        +'<span style="font-size:.78rem;color:var(--muted)">'+(o.paymentMethod==='cod'?'Cash on Delivery':o.paymentMethod.toUpperCase())+'</span></div>'
        +'</div>';
    }).join('')+'</div>';
  } catch(err) { div.innerHTML = '<div class="empty"><div class="ei">⚠️</div><h3>'+err.message+'</h3></div>'; }
}

/* ══ MODAL & TOAST ═════════════════════════════════════════════ */
function closeSuccess() { document.getElementById('success-overlay').classList.remove('open'); }
document.getElementById('success-overlay').addEventListener('click', function(e) { if (e.target === this) closeSuccess(); });

var _tt;
function showToast(icon, msg) {
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent  = msg;
  var t = document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(function(){ t.classList.remove('show'); }, 3500);
}

/* ══ INIT ══════════════════════════════════════════════════════ */
renderHeader();
updateBadge();
loadProducts();
