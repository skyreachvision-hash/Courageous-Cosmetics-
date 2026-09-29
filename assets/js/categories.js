const categorySections = document.querySelector('[data-main-category-sections]');
const categoryStatus = document.querySelector('[data-category-status]');
const subcategoryShowcase = document.querySelector('[data-subcategory-showcase]');
const subcategoryStatus = document.querySelector('[data-subcategory-status]');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[character]));

const getPrimaryImage = (product) => {
  if (!Array.isArray(product?.images) || !product.images.length) return null;
  return product.images.find((image) => Number(image.is_primary) === 1)?.image_url
    || product.images[0]?.image_url
    || null;
};

const formatPrice = (product) => {
  const amount = Number(product?.effective_price ?? product?.price);
  const regular = Number(product?.price);
  const currency = String(product?.currency || 'ZAR').toUpperCase();
  if (!Number.isFinite(amount)) return `${escapeHtml(currency)} 0.00`;
  if (Number(product?.promotion_enabled) === 1 && Number.isFinite(regular) && regular !== amount) return '<span class="price-original">' + escapeHtml(currency) + ' ' + regular.toFixed(2) + '</span> ' + escapeHtml(currency) + ' ' + amount.toFixed(2);
  return `${escapeHtml(currency)} ${amount.toFixed(2)}`;
};

const renderProductCard = (product) => {
  const imageUrl = getPrimaryImage(product);
  const imageContent = imageUrl
    ? `<span data-product-image style="display:block;width:100%;height:100%;min-height:340px;background-image:url('${escapeHtml(imageUrl).replace(/'/g, '%27')}');background-size:contain;background-position:center;background-repeat:no-repeat;" aria-hidden="true"></span>`
    : '<span>No image</span>';
  const badges = [];
  if (product.status === 'active' && product.is_new) badges.push('<span class="product-badge">New</span>');
  if (product.status === 'active' && product.promotion_enabled) badges.push('<span class="product-badge">Sale</span>');
  const badge = badges.join('');

  return `<article class="product-card">
    <a class="product-image" href="/product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}">
      ${imageContent}${badge}
    </a>
    <div class="product-info">
      <div><p class="product-category">${escapeHtml(product.category_name || 'Uncategorized')}</p><h3><a href="/product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3></div>
      <strong class="price">${formatPrice(product)}</strong>
    </div>
    <div class="product-actions">
      <button class="product-action" type="button" data-add-to-cart data-product-id="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to cart">Add to cart <span aria-hidden="true">+</span></button>
      <button class="product-buy-now" type="button" data-buy-now data-product-id="${escapeHtml(product.id)}" aria-label="Buy ${escapeHtml(product.name)} now">Buy now <span aria-hidden="true">↗</span></button>
    </div>
  </article>`;
};

const sortByStoreOrder = (a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id);

function renderMerchandisingSections(products) {
  const newArrivalsElement = document.querySelector('[data-new-arrivals]');
  const promotionsElement = document.querySelector('[data-promotions]');
  const render = (items, emptyText) => items.length
    ? `<div class="product-grid">${items.slice(0, 8).map(renderProductCard).join('')}</div>`
    : `<p class="muted">${emptyText}</p>`;
  if (newArrivalsElement) newArrivalsElement.innerHTML = render(products.filter((product) => Number(product.is_new) === 1), 'No new arrivals are currently available.');
  if (promotionsElement) promotionsElement.innerHTML = render(products.filter((product) => Number(product.promotion_enabled) === 1), 'No promotions are currently available.');
}

function renderSubcategoryShowcase(categories) {
  if (!subcategoryShowcase) return;

  const subcategories = categories
    .filter((category) =>
      Number(category.is_enabled) === 1 &&
      Number(category.is_main_category) !== 1 &&
      String(category.showcase_image_url || '').trim()
    )
    .sort(sortByStoreOrder);

  if (!subcategories.length) {
    subcategoryShowcase.innerHTML = '';
    if (subcategoryStatus) subcategoryStatus.hidden = true;
    return;
  }

  subcategoryShowcase.innerHTML = subcategories.map((subcategory) => {
    const imageUrl = String(subcategory.showcase_image_url).trim();
    const altText = String(subcategory.showcase_image_alt || subcategory.name).trim();
    const parentId = Number(subcategory.parent_id);
    const href = Number.isInteger(parentId) && parentId > 0
      ? `category.html?id=${encodeURIComponent(parentId)}&subcategory=${encodeURIComponent(subcategory.id)}`
      : '#categories';

    return `<a class="subcategory-showcase-card" href="${href}" aria-label="Shop ${escapeHtml(subcategory.name)}">
      <span class="subcategory-showcase-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" loading="lazy"></span>
      <span class="subcategory-showcase-name">${escapeHtml(subcategory.name)}</span>
    </a>`;
  }).join('');
}

async function loadMainCategoriesWithProducts() {
  if (!categorySections) return;

  try {
    const [categoryResponse, productResponse] = await Promise.all([
      fetch('/api/categories', { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch('/api/products?limit=100', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    ]);

    const categoryPayload = await categoryResponse.json().catch(() => ({}));
    const productPayload = await productResponse.json().catch(() => ({}));
    if (!categoryResponse.ok || !categoryPayload.success) throw new Error(categoryPayload.error || 'Unable to load categories.');
    if (!productResponse.ok || !productPayload.success) throw new Error(productPayload.error || 'Unable to load products.');

    const categories = Array.isArray(categoryPayload.data) ? categoryPayload.data : [];
    const products = Array.isArray(productPayload.data?.products)
      ? productPayload.data.products
      : Array.isArray(productPayload.data)
        ? productPayload.data
        : [];

    const catalogue = products.length ? { categories, products } : (window.COURAGEOUS_DEMO_CATALOGUE || { categories, products });
    const displayCategories = catalogue.categories || categories;
    const displayProducts = catalogue.products || products;

    renderMerchandisingSections(displayProducts);
    renderSubcategoryShowcase(displayCategories);

    const mainCategories = displayCategories
      .filter((category) => Number(category.is_enabled) === 1 && Number(category.is_main_category) === 1)
      .sort(sortByStoreOrder);

    const categoryTiles = mainCategories.map((mainCategory) => {
      const subcategoryCount = displayCategories.filter(
        (category) =>
          Number(category.is_enabled) === 1 &&
          Number(category.parent_id) === Number(mainCategory.id) &&
          Number(category.is_main_category) !== 1
      ).length;

      return `<a class="homepage-category-tile" href="category.html?id=${encodeURIComponent(mainCategory.id)}">
        <span class="homepage-category-number">${String(mainCategory.sort_order ?? '').padStart(2, '0')}</span>
        <span class="homepage-category-copy">
          <span class="eyebrow">Collection</span>
          <strong>${escapeHtml(mainCategory.name)}</strong>
          <small>${subcategoryCount} ${subcategoryCount === 1 ? 'collection' : 'collections'}</small>
        </span>
        <span class="homepage-category-arrow" aria-hidden="true">↗</span>
      </a>`;
    }).join('');

    categorySections.innerHTML = categoryTiles
      ? `<div class="homepage-category-grid">${categoryTiles}</div>`
      : '<p class="muted">No enabled main categories are currently configured.</p>';
  } catch (error) {
    const demo = window.COURAGEOUS_DEMO_CATALOGUE;
    if (demo?.categories?.length && demo?.products?.length) {
      renderMerchandisingSections(demo.products);
      renderSubcategoryShowcase(demo.categories);
      const mainCategories = demo.categories.filter((category) => Number(category.is_enabled) === 1 && Number(category.is_main_category) === 1).sort(sortByStoreOrder);
      categorySections.innerHTML = mainCategories.map((mainCategory) => {
        const subcategories = demo.categories.filter((category) => Number(category.is_enabled) === 1 && Number(category.parent_id) === Number(mainCategory.id) && Number(category.is_main_category) !== 1).sort(sortByStoreOrder);
        return `<section class="category-main-section" aria-labelledby="main-category-${escapeHtml(mainCategory.id)}">
          <a class="section-heading category-link-card" href="category.html?id=${encodeURIComponent(mainCategory.id)}">
            <div><p class="eyebrow">Main category</p><h2 id="main-category-${escapeHtml(mainCategory.id)}">${escapeHtml(mainCategory.name)}</h2></div>
          </a>
          ${subcategories.map((subcategory) => {
            const items = demo.products.filter((product) => Number(product.category_id) === Number(subcategory.id));
            return `<div class="category-product-section">
              <a class="section-heading category-link-card" href="category.html?id=${encodeURIComponent(mainCategory.id)}&subcategory=${encodeURIComponent(subcategory.id)}">
                <div><p class="eyebrow">Subcategory</p><h3>${escapeHtml(subcategory.name)}</h3></div>
              </a>
              <div class="product-grid">${items.slice(0, 4).map(renderProductCard).join('')}</div>
            </div>`;
          }).join('')}
        </section>`;
      }).join('');
      if (categoryStatus) categoryStatus.textContent = 'Showing temporary demo products for storefront design.';
      if (subcategoryStatus) subcategoryStatus.textContent = 'Demo catalogue';
      return;
    }
    categorySections.innerHTML = '<p class="muted">Store categories are temporarily unavailable.</p>';
    if (categoryStatus) categoryStatus.textContent = error?.message || 'Unable to load categories.';
    if (subcategoryStatus) subcategoryStatus.textContent = error?.message || 'Unable to load categories.';
  }
}

loadMainCategoriesWithProducts();
