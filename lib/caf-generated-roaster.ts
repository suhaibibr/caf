import type { Roaster } from "@/lib/data";

export const CAF_GENERATED_ROASTER_SLUG = "created-by-caf";
export const CAF_GENERATED_ROASTER_NAME = "بواسطة كـاف";

export const cafGeneratedRoaster: Roaster = {
  slug: CAF_GENERATED_ROASTER_SLUG,
  name: CAF_GENERATED_ROASTER_NAME,
  shortName: "كـاف",
  description: "وصفات مولدة عبر محرك كـاف لوصفات xBloom.",
  about:
    "هذه المحمصة تجمع الوصفات التي ينشئها محرك كـاف تلقائيًا، مع حفظها كصفحات قابلة للمشاركة داخل الموقع.",
  location: "كـاف",
  logo: "CAF",
  coverImage:
    "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1800&q=85",
  accent: "#0EA5A4",
  featured: false,
};
