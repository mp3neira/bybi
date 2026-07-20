// ---------- Login real (Supabase Auth) ----------
// A senha não fica mais escrita aqui no código: quem confere se está certa
// é o próprio Supabase, do lado do servidor.
document.getElementById('lock-submit').addEventListener('click', unlock);
document.getElementById('lock-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock();
});

async function unlock() {
  const btn = document.getElementById('lock-submit');
  const errEl = document.getElementById('lock-error');
  const val = document.getElementById('lock-password').value;
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: val });

  btn.disabled = false;
  btn.textContent = 'Entrar';

  if (error) {
    errEl.textContent = 'Senha incorreta.';
    errEl.style.display = 'block';
    return;
  }
  showAdmin();
}

function showAdmin() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('admin-content').style.display = 'block';
  init();
}

async function logout() {
  await sb.auth.signOut();
  document.getElementById('admin-content').style.display = 'none';
  document.getElementById('lock-password').value = '';
  document.getElementById('lock-screen').style.display = 'flex';
}

document.getElementById('logout-btn').addEventListener('click', logout);

// Se já existir uma sessão válida (login feito antes), pula a tela de senha
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showAdmin();
})();

// ---------- Estado ----------
let products = [];       // vem do Supabase, já "achatado" pro formato usado na UI
let categories = [];     // [{id, name}]
let variantCount = 0;

async function init() {
  await Promise.all([loadCategories(), loadProducts(), loadTestimonials()]);
  renderCategorySelect();
  renderCategoriesList();
  renderList();
  renderTestimonialsList();
  resetForm();
  await renderOrders();
}

// ---------- Categorias ----------
async function loadCategories() {
  const { data, error } = await sb.from('categories').select('*').order('name');
  if (error) { console.error(error); categories = []; return; }
  categories = data; // [{id, name}]
}

function renderCategoriesList() {
  const el = document.getElementById('categories-list');
  if (categories.length === 0) {
    el.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Nenhuma categoria ainda.</p>';
    return;
  }
  el.innerHTML = categories.map(c => `
    <div class="product-row" style="padding:8px 0;">
      <div class="info">
        <input type="text" class="cat-edit-input" data-id="${c.id}" value="${c.name}" style="border:none; background:transparent; font-size:14px; font-weight:500; width:100%; padding:4px 0;" />
      </div>
      <div class="actions">
        <button class="icon-action danger" data-remove-cat="${c.id}" aria-label="Remover categoria"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.cat-edit-input').forEach(input => {
    input.addEventListener('change', async () => {
      const id = input.dataset.id;
      const newName = input.value.trim();
      if (!newName) return;
      const { error } = await sb.from('categories').update({ name: newName }).eq('id', id);
      if (error) { showToast('Erro ao renomear categoria.'); console.error(error); return; }
      await loadCategories();
      await loadProducts();
      renderCategorySelect();
      renderList();
      showToast('Categoria renomeada.');
    });
  });
  el.querySelectorAll('[data-remove-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.removeCat;
      if (!confirm('Remover essa categoria? Produtos ligados a ela ficam sem categoria.')) return;
      const { error } = await sb.from('categories').delete().eq('id', id);
      if (error) { showToast('Erro ao remover categoria.'); console.error(error); return; }
      await loadCategories();
      renderCategoriesList();
      renderCategorySelect();
      showToast('Categoria removida.');
    });
  });
}

function renderCategorySelect() {
  const select = document.getElementById('p-category');
  const current = select.value;
  select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if ([...select.options].some(o => o.value === current)) select.value = current;
}

document.getElementById('add-category').addEventListener('click', async () => {
  const input = document.getElementById('new-category');
  const name = input.value.trim().toLowerCase();
  if (!name) return;
  const { error } = await sb.from('categories').insert({ name });
  if (error) { showToast('Essa categoria já existe ou deu erro.'); console.error(error); return; }
  input.value = '';
  await loadCategories();
  renderCategoriesList();
  renderCategorySelect();
  showToast('Categoria adicionada.');
});

// ---------- Produtos ----------
async function loadProducts() {
  const { data, error } = await sb
    .from('products')
    .select('id, name, price, badge, category_id, categories(name), product_variants(id, color_name, hex_color, image_url, sort_order)')
    .order('created_at');
  if (error) { console.error(error); products = []; return; }
  products = data.map(p => ({
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    badge: p.badge,
    category_id: p.category_id,
    category_name: p.categories ? p.categories.name : '—',
    variants: (p.product_variants || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function renderList() {
  const listEl = document.getElementById('products-list');
  if (products.length === 0) {
    listEl.innerHTML = '<p style="color:var(--ink-soft); font-size:14px;">Nenhum produto cadastrado ainda.</p>';
    return;
  }
  listEl.innerHTML = products.map(p => `
    <div class="product-row">
      <img src="${p.variants[0] ? p.variants[0].image_url : ''}" alt="${p.name}" />
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="meta">${p.category_name} · R$ ${p.price.toFixed(2)} · ${p.variants.length} cor(es)</div>
      </div>
      <div class="actions">
        <button class="icon-action" data-edit="${p.id}" aria-label="Editar"><i class="ti ti-edit"></i></button>
        <button class="icon-action danger" data-delete="${p.id}" aria-label="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.edit)));
  listEl.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.delete)));
}

// ---------- Variantes no formulário (com upload de imagem) ----------
function addVariantRow(variant) {
  variantCount++;
  const id = `variant-${variantCount}`;
  const wrap = document.createElement('div');
  wrap.className = 'variant-row-full';
  wrap.dataset.variantId = id;
  wrap.style = 'border:1px solid var(--cream-2); border-radius:12px; padding:12px; margin-bottom:10px;';
  wrap.innerHTML = `
    <div style="display:grid; grid-template-columns:2fr 1fr auto; gap:8px; margin-bottom:8px;">
      <input type="text" placeholder="Nome da cor (ex: Cinza chumbo)" class="v-color-name" value="${variant ? variant.color_name : ''}" />
      <input type="color" class="v-hex" value="${variant ? variant.hex_color : '#999999'}" />
      <button type="button" class="icon-action danger" aria-label="Remover cor"><i class="ti ti-x"></i></button>
    </div>
    <div style="display:flex; gap:10px; align-items:center;">
      <img class="v-preview" src="${variant ? variant.image_url : ''}" style="width:52px; height:64px; object-fit:cover; border-radius:8px; background:var(--cream-2); ${variant && variant.image_url ? '' : 'display:none;'}" />
      <label class="btn btn-outline btn-small" style="cursor:pointer;">
        <i class="ti ti-upload"></i> Escolher imagem do computador
        <input type="file" class="v-file-input" accept="image/*" style="display:none;" />
      </label>
      <span class="v-upload-status" style="font-size:12px; color:var(--ink-soft);"></span>
    </div>
    <input type="hidden" class="v-img" value="${variant ? variant.image_url : ''}" />
  `;
  wrap.querySelector('button.icon-action').addEventListener('click', () => wrap.remove());

  const fileInput = wrap.querySelector('.v-file-input');
  const statusEl = wrap.querySelector('.v-upload-status');
  const previewEl = wrap.querySelector('.v-preview');
  const hiddenInput = wrap.querySelector('.v-img');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusEl.textContent = 'Enviando...';
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await sb.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = sb.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
      hiddenInput.value = publicUrlData.publicUrl;
      previewEl.src = publicUrlData.publicUrl;
      previewEl.style.display = 'block';
      statusEl.textContent = 'Enviada ✓';
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Erro ao enviar — confira o bucket no Supabase.';
    }
  });

  document.getElementById('variants-list').appendChild(wrap);
}

document.getElementById('add-variant').addEventListener('click', () => addVariantRow(null));

function resetForm() {
  document.getElementById('product-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('variants-list').innerHTML = '';
  document.getElementById('form-title').textContent = 'Adicionar novo produto';
  document.getElementById('cancel-edit').style.display = 'none';
  addVariantRow(null);
}

document.getElementById('cancel-edit').addEventListener('click', resetForm);

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('edit-id').value = id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-category').value = p.category_id;
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-badge').value = p.badge || '';
  document.getElementById('variants-list').innerHTML = '';
  p.variants.forEach(v => addVariantRow(v));
  document.getElementById('form-title').textContent = `Editando: ${p.name}`;
  document.getElementById('cancel-edit').style.display = 'inline-flex';
  window.scrollTo({ top: document.getElementById('form-title').offsetTop - 20, behavior: 'smooth' });
}

async function deleteProduct(id) {
  if (!confirm('Excluir esse produto da loja?')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { showToast('Erro ao excluir produto.'); console.error(error); return; }
  await loadProducts();
  renderList();
  showToast('Produto removido.');
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const variantRows = Array.from(document.querySelectorAll('.variant-row-full'));
  const variants = variantRows.map((row, i) => ({
    color_name: row.querySelector('.v-color-name').value.trim(),
    hex_color: row.querySelector('.v-hex').value,
    image_url: row.querySelector('.v-img').value.trim(),
    sort_order: i,
  })).filter(v => v.color_name && v.image_url);

  if (variants.length === 0) {
    showToast('Adicione pelo menos uma cor com imagem enviada.');
    return;
  }

  const productPayload = {
    name: document.getElementById('p-name').value.trim(),
    category_id: document.getElementById('p-category').value,
    price: parseFloat(document.getElementById('p-price').value),
    badge: document.getElementById('p-badge').value.trim() || null,
  };

  try {
    let productId = editId;
    if (editId) {
      const { error } = await sb.from('products').update(productPayload).eq('id', editId);
      if (error) throw error;
      // Substitui as variantes: remove as antigas e insere as atuais
      const { error: delErr } = await sb.from('product_variants').delete().eq('product_id', editId);
      if (delErr) throw delErr;
    } else {
      const { data, error } = await sb.from('products').insert(productPayload).select().single();
      if (error) throw error;
      productId = data.id;
    }

    const variantsPayload = variants.map(v => ({ ...v, product_id: productId }));
    const { error: variantsError } = await sb.from('product_variants').insert(variantsPayload);
    if (variantsError) throw variantsError;

    showToast(editId ? 'Produto atualizado.' : 'Produto adicionado.');
    await loadProducts();
    renderList();
    resetForm();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar produto — veja o console pra detalhes.');
  }
});

// ---------- Pedidos ----------
function waLink(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = '55' + digits;
  return `https://wa.me/${digits}`;
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function renderOrders() {
  const el = document.getElementById('orders-list');
  const { data: orders, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    el.innerHTML = '<p class="order-empty">Erro ao carregar pedidos — veja o console.</p>';
    console.error(error);
    return;
  }

  if (orders.length === 0) {
    el.innerHTML = '<p class="order-empty">Nenhum pedido recebido ainda.</p>';
    return;
  }

  el.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-top">
        <div class="order-customer">
          <div class="name">${o.customer_name} <span class="order-pay-tag">${o.payment_preference}</span></div>
          <div class="addr">${o.customer_address}, ${o.customer_number} — ${o.customer_city} (CEP ${o.customer_cep})</div>
          <div class="addr">${formatDate(o.created_at)}</div>
        </div>
        <div class="order-total">R$ ${parseFloat(o.total).toFixed(2)}</div>
      </div>
      <div class="order-items">
        ${o.order_items.map(i => `<div>${i.quantity}x ${i.product_name} — ${i.variant_name}</div>`).join('')}
      </div>
      <div class="order-actions">
        <a class="wa-order-link" href="${waLink(o.customer_phone)}" target="_blank"><i class="ti ti-brand-whatsapp"></i> Chamar ${o.customer_name.split(' ')[0]}</a>
        <select class="order-status" data-order="${o.id}">
          <option value="novo" ${o.status === 'novo' ? 'selected' : ''}>Novo</option>
          <option value="combinando" ${o.status === 'combinando' ? 'selected' : ''}>Combinando pagamento</option>
          <option value="pago" ${o.status === 'pago' ? 'selected' : ''}>Pago</option>
          <option value="enviado" ${o.status === 'enviado' ? 'selected' : ''}>Enviado</option>
          <option value="cancelado" ${o.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
        <button class="icon-action danger" data-delete-order="${o.id}" aria-label="Excluir pedido"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.order-status').forEach(sel => {
    sel.addEventListener('change', async () => {
      const { error } = await sb.from('orders').update({ status: sel.value, updated_at: new Date().toISOString() }).eq('id', sel.dataset.order);
      if (error) { showToast('Erro ao atualizar status.'); console.error(error); return; }
      showToast('Status atualizado.');
    });
  });
  el.querySelectorAll('[data-delete-order]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esse pedido da lista?')) return;
      const { error } = await sb.from('orders').delete().eq('id', btn.dataset.deleteOrder);
      if (error) { showToast('Erro ao excluir pedido.'); console.error(error); return; }
      renderOrders();
    });
  });
}

// ---------- Depoimentos ----------
let testimonials = [];

async function loadTestimonials() {
  const { data, error } = await sb.from('testimonials').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); testimonials = []; return; }
  testimonials = data;
}

function renderTestimonialsList() {
  const el = document.getElementById('testimonials-list');
  if (!el) return;
  if (testimonials.length === 0) {
    el.innerHTML = '<p style="color:var(--ink-soft); font-size:13px;">Nenhum depoimento cadastrado ainda.</p>';
    return;
  }
  el.innerHTML = testimonials.map(t => `
    <div class="product-row">
      <div class="info">
        <div class="name">${t.customer_name}</div>
        <div class="meta">${t.text}</div>
      </div>
      <div class="actions">
        <button class="icon-action" data-toggle-testimonial="${t.id}" title="${t.approved ? 'Ocultar do site' : 'Mostrar no site'}">
          <i class="ti ${t.approved ? 'ti-eye' : 'ti-eye-off'}"></i>
        </button>
        <button class="icon-action danger" data-delete-testimonial="${t.id}" aria-label="Excluir depoimento"><i class="ti ti-trash"></i></button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-toggle-testimonial]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = testimonials.find(x => x.id === btn.dataset.toggleTestimonial);
      if (!t) return;
      const { error } = await sb.from('testimonials').update({ approved: !t.approved }).eq('id', t.id);
      if (error) { showToast('Erro ao atualizar depoimento.'); console.error(error); return; }
      await loadTestimonials();
      renderTestimonialsList();
      showToast(!t.approved ? 'Depoimento agora aparece no site.' : 'Depoimento ocultado do site.');
    });
  });
  el.querySelectorAll('[data-delete-testimonial]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir esse depoimento?')) return;
      const { error } = await sb.from('testimonials').delete().eq('id', btn.dataset.deleteTestimonial);
      if (error) { showToast('Erro ao excluir depoimento.'); console.error(error); return; }
      await loadTestimonials();
      renderTestimonialsList();
      showToast('Depoimento removido.');
    });
  });
}

document.getElementById('add-testimonial') && document.getElementById('add-testimonial').addEventListener('click', async () => {
  const nameInput = document.getElementById('new-testimonial-name');
  const textInput = document.getElementById('new-testimonial-text');
  const text = textInput.value.trim();
  if (!text) { showToast('Escreve o texto do depoimento.'); return; }
  const customer_name = nameInput.value.trim() || 'Cliente Bybi';

  const { error } = await sb.from('testimonials').insert({ customer_name, text, approved: true });
  if (error) { showToast('Erro ao adicionar depoimento.'); console.error(error); return; }
  nameInput.value = '';
  textInput.value = '';
  await loadTestimonials();
  renderTestimonialsList();
  showToast('Depoimento adicionado.');
});

// ---------- Toast ----------
function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}
