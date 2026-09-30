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
// Columnas del Sheet: ID, Categoría, Título, Precio Hombre ($), Precio Especial ($),
//                     Descripción, Talles, Colores, Foto (URL), Visible
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
      imagen:        (row['foto (url)'] || row['imagen'] || '').trim(),
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

  // Convierte link de Google Drive a URL directa de imagen
  function driveUrl(url) {
    if (!url) return '';
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return url;
  }

  const imgSrc = driveUrl(p.imagen);
  const imgHTML = imgSrc
    ? `<img src="${imgSrc}" alt="${p.nombre}" loading="lazy" />`
    : `<div class="product-img-placeholder">${p.nombre}</div>`;

    const badgeHTML = p.destacado
      ? `<span class="product-badge">Destacado</span>`
      : '';

    const precioHTML = p.precio
      ? `<div class="product-prices">
           <span class="product-price">$${Number(p.precio).toLocaleString('es-AR')}<span class="product-price-unit"> hombre</span></span>
           ${p.precioEspecial ? `<span class="product-price product-price-esp">$${Number(p.precioEspecial).toLocaleString('es-AR')}<span class="product-price-unit"> especial</span></span>` : ''}
         </div>`
      : '';

    card.innerHTML = `
      <div class="product-img-wrap">
        ${imgHTML}
        ${badgeHTML}
      </div>
      <div class="product-info">
        <div class="product-cat">${p.categoria || ''}</div>
        <div class="product-name">${p.nombre}</div>
        ${p.descripcion ? `<div class="product-desc">${p.descripcion}</div>` : ''}
        ${precioHTML}
      </div>
    `;

    // WhatsApp consult on click
    card.addEventListener('click', () => {
      const msg = `Hola! Me interesa el producto: *${p.nombre}* (${p.categoria}). Quisiera mas info.`;
      window.open(`https://wa.me/5491158266373?text=${encodeURIComponent(msg)}`, '_blank');
    });

    productsGrid.appendChild(card);
  });
}

// ---- Filter buttons (dinámicos, basados en categorías reales) ----
const filtersContainer = document.getElementById('filters');

function buildFilters(products) {
  // Obtener categorías únicas en el orden en que aparecen
  const cats = ['todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];
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
