/* ========================================
   D'MENT — App JavaScript
   ======================================== */

// ---- Navbar scroll effect ----
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ---- Hamburger menu ----
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
// Close on link click
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ---- Reveal on scroll ----
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // stagger siblings
      const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
      const idx = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = (idx * 0.1) + 's';
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---- Catalog: Google Sheets o productos.json ----
// Para usar Google Sheets:
//   1. Abre el Sheet > Archivo > Compartir > Publicar en la web
//   2. Selecciona la hoja y formato CSV > Publicar
//   3. Copia el link y pegalo en SHEET_CSV_URL (reemplaza el texto de abajo)
// Para desactivar Sheets y usar solo productos.json, deja SHEET_CSV_URL = ''
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRtPfr3lp0k27pfn9CphWCqvUqbRVxc0H5h28zpZtyef-Cy8J5W6S3YHR5vESOVQjRvC9SVILMKmjrd/pub?output=csv';

const productsGrid = document.getElementById('productsGrid');
const noProducts   = document.getElementById('noProducts');
const filterBtns   = document.querySelectorAll('.filter-btn');

let allProducts = [];
let activeFilter = 'todos';
let cart = loadCart();

const cartToggle = document.getElementById('cartToggle');
const cartCount = document.getElementById('cartCount');
const cartPanel = document.getElementById('cartPanel');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartItemsContainer = document.getElementById('cartItems');
const checkoutWhatsApp = document.getElementById('checkoutWhatsApp');

cartToggle.addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
cartBackdrop.addEventListener('click', closeCart);
checkoutWhatsApp.addEventListener('click', sendCartToWhatsApp);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && cartPanel.classList.contains('open')) closeCart();
});

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem('dment-cart') || '{}');
    return new Map(Object.entries(saved).map(([id, quantity]) => [id, Math.max(1, Number(quantity) || 1)]));
  } catch (error) {
    return new Map();
  }
}

function saveCart() {
  try { localStorage.setItem('dment-cart', JSON.stringify(Object.fromEntries(cart))); } catch (error) { /* El carrito sigue funcionando durante esta visita. */ }
}

function openCart() {
  cartPanel.classList.add('open');
  cartPanel.setAttribute('aria-hidden', 'false');
  cartToggle.setAttribute('aria-expanded', 'true');
  cartBackdrop.hidden = false;
  document.body.classList.add('cart-open');
  document.getElementById('cartClose').focus();
}

function closeCart() {
  cartPanel.classList.remove('open');
  cartPanel.setAttribute('aria-hidden', 'true');
  cartToggle.setAttribute('aria-expanded', 'false');
  cartBackdrop.hidden = true;
  document.body.classList.remove('cart-open');
  cartToggle.focus();
}

function addToCart(product) {
  const id = String(product.id);
  cart.set(id, (cart.get(id) || 0) + 1);
  saveCart();
  renderCart();
}

function renderCart() {
  [...cart.keys()].forEach(id => {
    if (!allProducts.some(product => String(product.id) === id)) cart.delete(id);
  });
  const totalItems = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  cartCount.textContent = totalItems;
  cartToggle.setAttribute('aria-label', `Carrito, ${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`);
  checkoutWhatsApp.disabled = totalItems === 0;
  cartItemsContainer.innerHTML = '';

  const selected = [...cart.entries()].map(([id, quantity]) => ({
    product: allProducts.find(product => String(product.id) === id), quantity,
  })).filter(item => item.product);

  if (!selected.length) {
    const empty = document.createElement('div');
    empty.className = 'cart-empty';
    empty.innerHTML = '<span aria-hidden="true">◌</span><p>Tu carrito está vacío.</p><small>Agregá productos del catálogo para armar tu consulta.</small>';
    cartItemsContainer.appendChild(empty);
    return;
  }

  selected.forEach(({ product, quantity }) => {
    const item = document.createElement('article');
    item.className = 'cart-item';
    const imageUrl = normalizeImageItems(product.imagenes ?? product.imagen, 'Producto')[0]?.url;
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = driveUrl(imageUrl);
      image.alt = '';
      image.loading = 'lazy';
      item.appendChild(image);
    }

    const details = document.createElement('div');
    details.className = 'cart-item-details';
    const category = document.createElement('span');
    category.className = 'cart-item-category';
    category.textContent = product.categoria || '';
    const name = document.createElement('h3');
    name.textContent = product.nombre;
    const quantityControls = document.createElement('div');
    quantityControls.className = 'quantity-controls';
    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.textContent = '−';
    decrease.setAttribute('aria-label', `Quitar una unidad de ${product.nombre}`);
    const quantityLabel = document.createElement('span');
    quantityLabel.textContent = quantity;
    const increase = document.createElement('button');
    increase.type = 'button';
    increase.textContent = '+';
    increase.setAttribute('aria-label', `Agregar una unidad de ${product.nombre}`);
    decrease.addEventListener('click', () => updateCartQuantity(product.id, -1));
    increase.addEventListener('click', () => updateCartQuantity(product.id, 1));
    quantityControls.append(decrease, quantityLabel, increase);
    details.append(category, name, quantityControls);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-remove';
    remove.textContent = 'Quitar';
    remove.setAttribute('aria-label', `Quitar ${product.nombre} del carrito`);
    remove.addEventListener('click', () => removeFromCart(product.id));
    item.append(details, remove);
    cartItemsContainer.appendChild(item);
  });
}

function updateCartQuantity(id, change) {
  const key = String(id);
  const next = (cart.get(key) || 0) + change;
  if (next < 1) cart.delete(key);
  else cart.set(key, next);
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart.delete(String(id));
  saveCart();
  renderCart();
}

function sendCartToWhatsApp() {
  const lines = [...cart.entries()].map(([id, quantity]) => {
    const product = allProducts.find(item => String(item.id) === id);
    return product ? `• ${quantity} x ${product.nombre} (${product.categoria})` : '';
  }).filter(Boolean);
  if (!lines.length) return;
  const message = `Hola D’MENT, quisiera consultar precio y disponibilidad de estos productos:\n\n${lines.join('\n')}\n\n¡Gracias!`;
  window.open(`https://wa.me/5491158266373?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

// Parsea una linea CSV respetando campos entre comillas
function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  result.push(cur.trim());
  return result;
}

// Convierte filas CSV al mismo formato que productos.json
// Columnas de imágenes opcionales: Foto (URL), Fotos adicionales (URL),
// Fotos modelo (URL), Foto categoría (URL). Varios links se separan con " | ".
function parseImageList(value) {
  return String(value || '').split('|').map(url => url.trim()).filter(Boolean);
}

function parsePrice(val) {
  if (!val) return 0;
  // En el Sheet el formato es "$5,200" donde la coma es separador de miles
  // → solo sacamos $ y , para obtener 5200
  return parseFloat(
    String(val).replace(/\$/g, '').replace(/,/g, '').trim()
  ) || 0;
}

function csvToProducts(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row  = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });

    const nombre    = (row['título']    || row['titulo']    || '').trim();
    const categoria = (row['categoría'] || row['categoria'] || '').trim();
    if (!nombre) continue;

    // Visible = SI para mostrar; cualquier otra cosa lo oculta
    const visible = (row['visible'] || 'SI').trim().toUpperCase();
    if (visible !== 'SI') continue;

    const precioHombre   = parsePrice(row['precio hombre ($)']   || row['precio hombre']   || '0');
    const precioEspecial = parsePrice(row['precio especial ($)'] || row['precio especial'] || '0');

    // Colores: separados por coma en el Sheet
    const colores = (row['colores'] || '').split(',').map(v => v.trim()).filter(Boolean);
    // Talles: texto libre ("Hombre: S al XXL | Especiales: 6 al 10")
    const tallesRaw = (row['talles'] || '').trim();

    products.push({
      id:            row['id'] || String(i),
      nombre,
      categoria,
      descripcion:   (row['descripción'] || row['descripcion'] || '').trim(),
      precio:        precioHombre,
      precioEspecial,
      imagenes:      parseImageList(row['foto (url)'] || row['imagen'] || ''),
      imagenesAdicionales: parseImageList(row['fotos adicionales (url)'] || ''),
      imagenesModelo: parseImageList(row['fotos modelo (url)'] || ''),
      fotoCategoria: (row['foto categoría (url)'] || row['foto categoria (url)'] || '').trim(),
      destacado:     false,
      colores,
      talles:        tallesRaw ? [tallesRaw] : [],
      codigo:        '',
    });
  }
  return products;
}

async function loadProducts() {
  // 1. Intentar Google Sheets si hay URL configurada
  if (SHEET_CSV_URL) {
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (res.ok) {
        const csv = await res.text();
        allProducts = csvToProducts(csv);
        if (allProducts.length > 0) {
          renderProducts(allProducts);
          renderCart();
          return;
        }
      }
    } catch (e) {
      // Sheet no disponible, caer al JSON local
    }
  }
  // 2. Fallback: productos.json local
  try {
    const res = await fetch('productos.json');
    if (!res.ok) throw new Error('No catalog');
    allProducts = await res.json();
    renderProducts(allProducts);
    renderCart();
  } catch (e) {
    noProducts.style.display = 'flex';
  }
}

function renderProducts(products) {
  // Reconstruir filtros con las categorías reales la primera vez
  if (products === allProducts) buildFilters(products);

  const filtered = activeFilter === 'todos'
    ? products
    : products.filter(p => p.categoria === activeFilter);

  // Clear grid (keep noProducts node hidden)
  productsGrid.querySelectorAll('.product-card').forEach(c => c.remove());

  if (filtered.length === 0) {
    noProducts.style.display = 'flex';
    return;
  }
  noProducts.style.display = 'none';

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageItems = [
      ...normalizeImageItems(p.imagenes ?? p.imagen, 'Producto'),
      ...normalizeImageItems(p.imagenesAdicionales, 'Vista adicional'),
      ...normalizeImageItems(p.imagenesModelo, 'En modelo'),
    ];

    const badgeHTML = p.destacado
      ? `<span class="product-badge">Destacado</span>`
      : '';

    const precioHTML = p.precio
      ? `<div class="product-prices">
           <span class="product-price">$${Number(p.precio).toLocaleString('es-AR')}<span class="product-price-unit"> hombre</span></span>
           ${p.precioEspecial ? `<span class="product-price product-price-esp">$${Number(p.precioEspecial).toLocaleString('es-AR')}<span class="product-price-unit"> especial</span></span>` : ''}
         </div>`
      : '';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-img-wrap';
    if (imageItems.length) {
      imageWrap.appendChild(createProductGallery(imageItems, p.nombre));
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'product-img-placeholder';
      placeholder.textContent = p.nombre;
      imageWrap.appendChild(placeholder);
    }
    if (p.destacado) imageWrap.insertAdjacentHTML('beforeend', badgeHTML);

    const info = document.createElement('div');
    info.className = 'product-info';
    info.innerHTML = `
        <div class="product-cat">${p.categoria || ''}</div>
        <div class="product-name">${p.nombre}</div>
        ${p.descripcion ? `<div class="product-desc">${p.descripcion}</div>` : ''}
        ${precioHTML}
    `;
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'add-to-cart';
    addButton.textContent = 'Agregar al carrito';
    addButton.setAttribute('aria-label', `Agregar ${p.nombre} al carrito`);
    addButton.addEventListener('click', event => {
      event.stopPropagation();
      addToCart(p);
      addButton.textContent = 'Agregado ✓';
      window.setTimeout(() => { addButton.textContent = 'Agregar al carrito'; }, 1100);
    });
    info.appendChild(addButton);
    card.append(imageWrap, info);

    productsGrid.appendChild(card);
  });
}

function driveUrl(url) {
  if (!url) return '';
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
  return url;
}

function normalizeImageItems(value, label) {
  const items = Array.isArray(value) ? value : parseImageList(value);
  return items.map(url => ({ url, label }));
}

function createProductGallery(items, productName) {
  const gallery = document.createElement('div');
  gallery.className = 'product-gallery';

  const image = document.createElement('img');
  image.className = 'product-gallery-image';
  image.alt = productName;
  image.loading = 'lazy';
  gallery.appendChild(image);

  const caption = document.createElement('span');
  caption.className = 'product-gallery-caption';
  gallery.appendChild(caption);

  if (items.length > 1) {
    const controls = document.createElement('div');
    controls.className = 'product-gallery-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'gallery-arrow';
    previous.setAttribute('aria-label', 'Foto anterior');
    previous.textContent = '‹';
    const count = document.createElement('span');
    count.className = 'gallery-count';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'gallery-arrow';
    next.setAttribute('aria-label', 'Foto siguiente');
    next.textContent = '›';
    controls.append(previous, count, next);
    gallery.appendChild(controls);

    let active = 0;
    const show = (index) => {
      active = (index + items.length) % items.length;
      image.src = driveUrl(items[active].url);
      image.alt = `${productName} — ${items[active].label}`;
      caption.textContent = items[active].label;
      count.textContent = `${active + 1}/${items.length}`;
    };
    previous.addEventListener('click', event => { event.stopPropagation(); show(active - 1); });
    next.addEventListener('click', event => { event.stopPropagation(); show(active + 1); });
    show(active);
  } else {
    image.src = driveUrl(items[0].url);
    caption.textContent = items[0].label;
  }
  return gallery;
}

// ---- Filter buttons (dinámicos, basados en categorías reales) ----
const filtersContainer = document.getElementById('filters');

function buildFilters(products) {
  // Obtener categorías únicas en el orden en que aparecen
  const cats = ['todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];
  buildCategoryCards(products);
  filtersContainer.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === activeFilter ? ' active' : '');
    btn.dataset.filter = cat;
    btn.textContent = cat === 'todos' ? 'Todos' : cat;
    btn.addEventListener('click', () => {
      filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = cat;
      renderProducts(allProducts);
    });
    filtersContainer.appendChild(btn);
  });
}

function buildCategoryCards(products) {
  const container = document.getElementById('categoryCards');
  if (!container) return;
  container.innerHTML = '';

  const categories = [...new Set(products.map(p => p.categoria).filter(Boolean))];
  categories.forEach(category => {
    const product = products.find(p => p.categoria === category);
    const categoryImage = products.find(p => p.categoria === category && p.fotoCategoria)?.fotoCategoria
      || normalizeImageItems(product?.imagenes ?? product?.imagen, 'Producto')[0]?.url
      || '';
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.dataset.cat = category;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.addEventListener('click', () => filterCat(category));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        filterCat(category);
      }
    });

    if (categoryImage) {
      const image = document.createElement('img');
      image.className = 'cat-image';
      image.src = driveUrl(categoryImage);
      image.alt = `Foto de ${category}`;
      image.loading = 'lazy';
      card.appendChild(image);
    }

    const displayName = ({ Sudaderas: 'Buzos', Bermudas: 'Shorts' })[category] || category;
    const label = document.createElement('span');
    label.className = 'cat-label';
    label.textContent = displayName;
    card.appendChild(label);
    container.appendChild(card);
  });
}

// ---- Filter from category section ----
function filterCat(cat) {
  activeFilter = cat;
  filtersContainer.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === cat);
  });
  renderProducts(allProducts);
  document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
}

// ---- Contact form -> WhatsApp ----
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre   = document.getElementById('nombre').value;
  const telefono = document.getElementById('telefono').value;
  const ciudad   = document.getElementById('ciudad').value;
  const mensaje  = document.getElementById('mensaje').value;

  const text = `Hola D'MENT! Me llamo *${nombre}* y les escribo desde *${ciudad}*.`
    + `\nTelefono: ${telefono}`
    + (mensaje ? `\nConsulta: ${mensaje}` : '');

  window.open(`https://wa.me/5491158266373?text=${encodeURIComponent(text)}`, '_blank');
});

// ---- Init ----
loadProducts();
