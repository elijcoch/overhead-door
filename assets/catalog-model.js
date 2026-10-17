/** Pure catalog rules shared by the interface and regression tests. */
export function matchingProducts(
  products,
  { category = "", style = "", material = "", words = [] },
) {
  return products.filter(
    (product) =>
      (!category || product.category === category) &&
      (!style || product.style === style) &&
      (!material || product.material === material) &&
      words.every((word) => product.searchText.includes(word)),
  );
}

export function availableValues(products, category, property) {
  return [
    ...new Set(
      products
        .filter((product) => !category || product.category === category)
        .map((product) => product[property])
        .filter(Boolean),
    ),
  ].sort();
}
