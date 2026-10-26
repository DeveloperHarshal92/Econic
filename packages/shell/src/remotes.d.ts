// Type declarations for Module Federation remotes
declare module 'catalog/CatalogApp' {
  const CatalogApp: React.ComponentType;
  export default CatalogApp;
}

declare module 'cart/CartApp' {
  const CartApp: React.ComponentType;
  export default CartApp;
}

declare module 'checkout/CheckoutApp' {
  const CheckoutApp: React.ComponentType;
  export default CheckoutApp;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

