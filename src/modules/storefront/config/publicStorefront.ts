// In production, the backend will resolve this slug from the storefront host.
// The mock frontend keeps it as deployment configuration until that endpoint exists.
export const publicStorefrontSlug = process.env.NEXT_PUBLIC_STOREFRONT_SLUG ?? "ferrepharma-demo";
