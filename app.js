// ---------- Estado ----------
let PRODUCTS = [];
let CATEGORIES = [];
let cart = JSON.parse(localStorage.getItem('bybi-cart') || '[]');
let currentFilter = 'todas';
let selectedPayment = 'Pix';
const selectedVariant = {}; // productId -> variant index escolhido no card
const selectedImage = {}; // productId -> índice da foto atual dentro da variante

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback pra quando o navegador não expõe crypto.randomUUID
  // (acontece fora de https/localhost, ex: acessando por IP da rede local)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getVariantImages(variant) {
  return (variant.images && variant.images.length) ? variant.images : [variant.img];
}

function updateCardMedia(card, product) {
  const vIndex = selectedVariant[product.id] || 0;
  const images = getVariantImages(product.variants[vIndex]);
  let imgIndex = selectedImage[product.id] || 0;
  if (imgIndex >= images.length) imgIndex = 0;
  selectedImage[product.id] = imgIndex;

  card.querySelector('[data-role="main-img"]').src = images[imgIndex];

  const showNav = images.length > 1;
  card.querySelectorAll('.img-nav').forEach(btn => btn.classList.toggle('hidden', !showNav));

  const dotsWrap = card.querySelector('[data-role="img-dots"]');
  dotsWrap.classList.toggle('hidden', !showNav);
  dotsWrap.innerHTML = images.map((_, i) => `<span class="img-dot ${i === imgIndex ? 'active' : ''}" data-dot="${i}"></span>`).join('');
  dotsWrap.querySelectorAll('.img-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedImage[product.id] = parseInt(dot.dataset.dot, 10);
      updateCardMedia(card, product);
    });
  });
}

function saveCart() {
  localStorage.setItem('bybi-cart', JSON.stringify(cart));
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function installmentText(price) {
  const n = 3;
  const value = price / n;
  return `ou ${n}x de ${formatBRL(value)} sem juros`;
}

// ---------- Carrega produtos e categorias do Supabase ----------
async function fetchCatalog() {
  try {
    const { data: catData, error: catError } = await sb.from('categories').select('*').order('name');
    if (catError) throw catError;
    CATEGORIES = catData.map(c => c.name);

    const { data: prodData, error: prodError } = await sb
      .from('products')
      .select('id, name, price, badge, category_id, categories(name), product_variants(id, color_name, hex_color, image_url, sort_order, product_images(id, image_url, sort_order))')
      .order('created_at');
    if (prodError) throw prodError;

    PRODUCTS = prodData.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      badge: p.badge,
      category: p.categories ? p.categories.name : '',
      variants: (p.product_variants || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(v => ({
          color: v.color_name,
          hex: v.hex_color,
          img: v.image_url,
          images: (v.product_images || []).sort((a, b) => a.sort_order - b.sort_order).map(im => im.image_url),
        })),
    })).filter(p => p.variants.length > 0);
  } catch (e) {
    console.error('Não consegui buscar do Supabase, usando dados padrão:', e);
    CATEGORIES = typeof DEFAULT_CATEGORIES !== 'undefined' ? DEFAULT_CATEGORIES : [];
    PRODUCTS = typeof DEFAULT_PRODUCTS !== 'undefined' ? DEFAULT_PRODUCTS : [];
  }
}

function renderFilters() {
  const filtersEl = document.getElementById('filters');
  if (!filtersEl) return;
  const chips = ['<button class="filter-chip active" data-filter="todas">Todas</button>']
    .concat(CATEGORIES.map(c => `<button class="filter-chip" data-filter="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</button>`));
  filtersEl.innerHTML = chips.join('');
}

// ---------- Render produtos ----------
function renderProducts() {
  const grid = document.getElementById('product-grid');
  const list = currentFilter === 'todas'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === currentFilter);

  if (list.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:var(--ink-soft);">Nenhuma peça nessa categoria ainda — chame no direct para uma personalizada.</p>';
    return;
  }

  grid.innerHTML = list.map((p, idx) => {
    const vIndex = selectedVariant[p.id] || 0;
    const variant = p.variants[vIndex];
    const images = getVariantImages(variant);
    let imgIndex = selectedImage[p.id] || 0;
    if (imgIndex >= images.length) imgIndex = 0;
    return `
    <div class="card reveal" style="transition-delay:${idx * 0.08}s" data-product="${p.id}">
      <div class="card-media">
        ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ''}
        <button class="card-fav" aria-label="Favoritar"><i class="ti ti-heart"></i></button>
        <img src="${images[imgIndex]}" alt="${p.name} - ${variant.color}" data-role="main-img" />
        <button class="img-nav prev ${images.length > 1 ? '' : 'hidden'}" data-img-nav="prev" aria-label="Foto anterior"><i class="ti ti-chevron-left"></i></button>
        <button class="img-nav next ${images.length > 1 ? '' : 'hidden'}" data-img-nav="next" aria-label="Próxima foto"><i class="ti ti-chevron-right"></i></button>
        <div class="img-dots ${images.length > 1 ? '' : 'hidden'}" data-role="img-dots">
          ${images.map((_, i) => `<span class="img-dot ${i === imgIndex ? 'active' : ''}" data-dot="${i}"></span>`).join('')}
        </div>
      </div>
      <div class="card-body">
        <span class="cat">${p.category}</span>
        <h3>${p.name}</h3>
        <div class="swatches" role="group" aria-label="Escolher cor">
          ${p.variants.map((v, i) => `
            <button class="swatch ${i === vIndex ? 'active' : ''}" style="background:${v.hex}" data-swatch="${i}" aria-label="${v.color}" title="${v.color}"></button>
          `).join('')}
        </div>
        <div class="variant-label" data-role="variant-label">${variant.color}</div>
        <div class="card-price">
          <div>
            <span class="price">${formatBRL(p.price)}</span>
            <div class="installments">${installmentText(p.price)}</div>
          </div>
          <button class="add-btn" data-add="${p.id}" aria-label="Adicionar ao carrinho"><i class="ti ti-plus"></i></button>
        </div>
      </div>
    </div>
  `;
  }).join('');

  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add));
  });

  grid.querySelectorAll('.swatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.card');
      const productId = card.dataset.product;
      const idx = parseInt(btn.dataset.swatch, 10);
      selectedVariant[productId] = idx;
      selectedImage[productId] = 0;
      const product = PRODUCTS.find(p => p.id === productId);
      const variant = product.variants[idx];
      card.querySelector('[data-role="variant-label"]').textContent = variant.color;
      card.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('active', i === idx));
      updateCardMedia(card, product);
    });
  });

  grid.querySelectorAll('[data-img-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.card');
      const productId = card.dataset.product;
      const product = PRODUCTS.find(p => p.id === productId);
      const vIndex = selectedVariant[productId] || 0;
      const images = getVariantImages(product.variants[vIndex]);
      if (images.length <= 1) return;
      let imgIndex = selectedImage[productId] || 0;
      imgIndex = btn.dataset.imgNav === 'next' ? (imgIndex + 1) % images.length : (imgIndex - 1 + images.length) % images.length;
      selectedImage[productId] = imgIndex;
      updateCardMedia(card, product);
    });
  });

  grid.querySelectorAll('.img-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = dot.closest('.card');
      const productId = card.dataset.product;
      const product = PRODUCTS.find(p => p.id === productId);
      selectedImage[productId] = parseInt(dot.dataset.dot, 10);
      updateCardMedia(card, product);
    });
  });
}

// ---------- Filtros ----------
document.getElementById('filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentFilter = chip.dataset.filter;
  renderProducts();
  setupRevealObserver();
});

// ---------- Carrinho ----------
function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  const vIndex = selectedVariant[productId] || 0;
  const variant = product.variants[vIndex];
  const cartKey = `${productId}-${vIndex}`;
  const existing = cart.find(i => i.key === cartKey);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      key: cartKey,
      id: product.id,
      name: product.name,
      variant: variant.color,
      price: product.price,
      img: variant.img,
      qty: 1,
    });
  }
  saveCart();
  renderCart();
  showToast(`${product.name} (${variant.color}) adicionada ao carrinho`);
  const cartBtn = document.getElementById('cart-btn');
  cartBtn.classList.remove('bump');
  requestAnimationFrame(() => cartBtn.classList.add('bump'));
}

function updateQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.key !== key);
  }
  saveCart();
  renderCart();
}

function cartTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function cartCount() {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

function renderCart() {
  document.getElementById('cart-count').textContent = cartCount();

  const itemsEl = document.getElementById('drawer-items');
  const footEl = document.getElementById('drawer-foot');

  if (cart.length === 0) {
    itemsEl.innerHTML = `
      <div class="drawer-empty">
        <i class="ti ti-shopping-bag-off"></i>
        <p>Seu carrinho está vazio.<br/>Que tal escolher uma Bybi?</p>
      </div>`;
    footEl.innerHTML = '';
    return;
  }

  itemsEl.innerHTML = cart.map(i => `
    <div class="drawer-item">
      <img src="${i.img}" alt="${i.name}" />
      <div class="drawer-item-info">
        <div class="name">${i.name}</div>
        <div class="variant">Cor: ${i.variant}</div>
        <div class="qty-row">
          <button class="qty-btn" data-qty-down="${i.key}">–</button>
          <span>${i.qty}</span>
          <button class="qty-btn" data-qty-up="${i.key}">+</button>
        </div>
      </div>
      <div>
        <div class="drawer-item-price">${formatBRL(i.price * i.qty)}</div>
      </div>
    </div>
  `).join('');

  const total = cartTotal();
  const shippingNote = `<div class="shipping-note"><i class="ti ti-truck"></i> Frete grátis para Brusque, SC</div>`;

  footEl.innerHTML = `
    ${shippingNote}
    <div class="subtotal-row">
      <span>Subtotal</span>
      <span class="amt">${formatBRL(total)}</span>
    </div>
    <button class="btn btn-primary" id="checkout-btn"><i class="ti ti-send"></i> Solicitar pedido</button>
  `;

  itemsEl.querySelectorAll('[data-qty-up]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyUp, 1)));
  itemsEl.querySelectorAll('[data-qty-down]').forEach(b => b.addEventListener('click', () => updateQty(b.dataset.qtyDown, -1)));
  document.getElementById('checkout-btn').addEventListener('click', openCheckout);
}

// ---------- Drawer open/close ----------
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');

function openDrawer() {
  drawer.classList.add('open');
  overlay.classList.add('open');
}
function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('open');
}

document.getElementById('cart-btn').addEventListener('click', openDrawer);
document.getElementById('close-drawer').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

// ---------- Checkout modal (formulário único de pedido) ----------
const checkoutOverlay = document.getElementById('checkout-overlay');

function openCheckout() {
  if (cart.length === 0) return;
  renderSummary();
  closeDrawer();
  checkoutOverlay.classList.add('open');
}
function closeCheckout() {
  checkoutOverlay.classList.remove('open');
}
document.getElementById('close-checkout').addEventListener('click', closeCheckout);

// ---------- CEP automático (ViaCEP) ----------
const cepInput = document.getElementById('checkout-cep');
if (cepInput) {
  cepInput.addEventListener('blur', async () => {
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        showToast('CEP não encontrado — confere os números.');
        return;
      }
      const addressField = document.getElementById('checkout-address');
      const cityField = document.getElementById('checkout-city');
      if (addressField) addressField.value = `${data.logradouro || ''}${data.bairro ? ', ' + data.bairro : ''}`;
      if (cityField) { cityField.value = data.localidade || ''; renderSummary(); }
    } catch (e) {
      showToast('Não consegui buscar o CEP agora — preenche manualmente.');
    }
  });
}

function renderSummary() {
  const summaryItems = document.getElementById('summary-items');
  summaryItems.innerHTML = cart.map(i => `
    <div class="summary-item">
      <img src="${i.img}" alt="${i.name}" />
      <div>
        <div class="name">${i.name}</div>
        <div class="qty">${i.variant} · Qtd: ${i.qty}</div>
      </div>
      <div class="price">${formatBRL(i.price * i.qty)}</div>
    </div>
  `).join('');
  const total = cartTotal();
  const cityInput = document.getElementById('checkout-city');
  const city = (cityInput && cityInput.value || '').trim().toLowerCase();
  const freeShipping = city.includes('brusque');
  const shippingCost = freeShipping ? 0 : 18.90;
  document.getElementById('summary-subtotal').textContent = formatBRL(total);
  document.getElementById('summary-shipping').textContent = freeShipping ? 'Grátis (Brusque)' : formatBRL(shippingCost);
  document.getElementById('summary-total').textContent = formatBRL(total + shippingCost);
  return { total: total + shippingCost, shippingCost };
}

document.getElementById('checkout-city') && document.getElementById('checkout-city').addEventListener('input', renderSummary);

// ---------- Forma de pagamento preferida (só uma preferência, não processa nada) ----------
document.querySelectorAll('.pay-method').forEach(m => {
  m.addEventListener('click', () => {
    document.querySelectorAll('.pay-method').forEach(x => x.classList.remove('active'));
    m.classList.add('active');
    selectedPayment = m.dataset.pay;
  });
});

// ---------- Envio do pedido pro Supabase ----------
document.getElementById('submit-order').addEventListener('click', async () => {
  const required = ['checkout-name', 'checkout-phone', 'checkout-cep', 'checkout-city', 'checkout-address', 'checkout-number'];
  const missing = required.some(id => {
    const el = document.getElementById(id);
    return el && !el.value.trim();
  });
  if (missing) {
    showToast('Preenche todos os dados antes de enviar o pedido.');
    return;
  }

  const { total, shippingCost } = renderSummary();
  const submitBtn = document.getElementById('submit-order');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  try {
    const orderId = generateUUID();
    const { error: orderError } = await sb.from('orders').insert({
      id: orderId,
      customer_name: document.getElementById('checkout-name').value.trim(),
      customer_phone: document.getElementById('checkout-phone').value.trim(),
      customer_cep: document.getElementById('checkout-cep').value.trim(),
      customer_city: document.getElementById('checkout-city').value.trim(),
      customer_address: document.getElementById('checkout-address').value.trim(),
      customer_number: document.getElementById('checkout-number').value.trim(),
      payment_preference: selectedPayment,
      status: 'novo',
      shipping_cost: shippingCost,
      total: total,
    });

    if (orderError) throw orderError;

    const items = cart.map(i => ({
      order_id: orderId,
      product_id: i.id,
      product_name: i.name,
      variant_name: i.variant,
      quantity: i.qty,
      unit_price: i.price,
    }));
    const { error: itemsError } = await sb.from('order_items').insert(items);
    if (itemsError) throw itemsError;

    showToast('Pedido enviado! A Gabi vai te chamar no WhatsApp pra combinar o pagamento.');
    closeCheckout();
    cart = [];
    saveCart();
    renderCart();
  } catch (e) {
    console.error(e);
    showToast('Não consegui enviar o pedido agora — tenta de novo em um instante.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ti ti-send"></i> Solicitar pedido';
  }
});

// ---------- Depoimentos ----------
async function renderTestimonials() {
  const el = document.getElementById('testimonials-grid');
  if (!el) return;
  let list = [];
  try {
    const { data, error } = await sb.from('testimonials').select('*').eq('approved', true).order('created_at', { ascending: false });
    if (error) throw error;
    list = data.map(t => ({ name: t.customer_name, text: t.text }));
  } catch (e) {
    list = typeof TESTIMONIALS !== 'undefined' ? TESTIMONIALS : [];
  }
  el.innerHTML = list.map((t, idx) => `
    <div class="testimonial-card reveal" style="transition-delay:${idx * 0.12}s">
      <i class="ti ti-quote"></i>
      <p>${t.text}</p>
      <span class="t-name">${t.name}</span>
    </div>
  `).join('');
  setupRevealObserver();
}

// ---------- Toast ----------
function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------- Animações de rolagem ----------
function setupRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal:not(.in-view)').forEach(el => observer.observe(el));
}

// ---------- Barra de aviso (frete/informações) alternando mensagens ----------
function setupAnnounceRotator() {
  const msgs = document.querySelectorAll('#announce-rotator .announce-msg');
  if (msgs.length < 2) return;
  let current = 0;
  setInterval(() => {
    msgs[current].classList.remove('is-active');
    current = (current + 1) % msgs.length;
    msgs[current].classList.add('is-active');
  }, 3800);
}

// ---------- Init ----------
async function init() {
  await fetchCatalog();
  renderFilters();
  renderProducts();
  renderCart();
  await renderTestimonials();
  setupRevealObserver();
  setupAnnounceRotator();
}
init();