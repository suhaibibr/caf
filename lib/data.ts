export type BrewMethod = "Espresso" | "Filter" | "Cold Brew";

export type Difficulty = "Easy" | "Medium" | "Advanced";

export type Roaster = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  about: string;
  location: string;
  logo: string;
  coverImage: string;
  accent: string;
  featured?: boolean;
  recipeCount?: number;
  approvedRecipeCount?: number;
};

export type Recipe = {
  slug: string;
  roasterSlug: string;
  name: string;
  method: BrewMethod;
  difficulty: Difficulty;
  brewTime: number;
  image: string;
  summary: string;
  tools: string[];
  ingredients: string[];
  steps: string[];
  featured?: boolean;
};

export const methodLabels: Record<BrewMethod, string> = {
  Espresso: "مختص",
  Filter: "ساخن",
  "Cold Brew": "بارد",
};

export const difficultyLabels: Record<Difficulty, string> = {
  Easy: "سهل",
  Medium: "متوسط",
  Advanced: "متقدم",
};

export const roasters: Roaster[] = [
  {
    slug: "northline",
    name: "محمصة نورث لاين",
    shortName: "نورث لاين",
    description: "تحميص هادئ ونظيف يبرز الفاكهة والوضوح في الكوب.",
    about:
      "نورث لاين تبني وصفاتها حول الوضوح والاتزان. القهوة هنا ناعمة، دقيقة، ومناسبة لمن يحب طقوس التحضير الهادئة ذات النكهة الطويلة.",
    location: "الرياض، السعودية",
    logo: "NL",
    coverImage:
      "https://images.unsplash.com/photo-1773118360501-00f979fd9322?auto=format&fit=crop&w=1800&q=85",
    accent: "#B7634B",
    featured: true,
  },
  {
    slug: "lumen",
    name: "محمصة لومِن",
    shortName: "لومِن",
    description: "إسبريسو متوازن ومشروبات حليب مصقولة بطابع يومي فاخر.",
    about:
      "لومِن تركّز على الحلاوة المريحة والقوام الناعم. وصفاتها مصممة لتكون واضحة في المنزل ومقنعة في البار.",
    location: "جدة، السعودية",
    logo: "LM",
    coverImage:
      "https://images.unsplash.com/photo-1773118360548-a46d54c0962a?auto=format&fit=crop&w=1800&q=85",
    accent: "#81906E",
    featured: true,
  },
  {
    slug: "ember-yard",
    name: "محمصة إمبِر يارد",
    shortName: "إمبر",
    description: "تحميص عميق ومخملي للمشروبات الباردة والإسبريسو.",
    about:
      "إمبر يارد تجعل القوام في المقدمة: شوكولاتة ناعمة، لمسة فاكهية، ووصفات تتحمل الثلج دون أن تفقد شخصيتها.",
    location: "دبي، الإمارات",
    logo: "EY",
    coverImage:
      "https://images.unsplash.com/photo-1765896977022-3079fd6bce8d?auto=format&fit=crop&w=1800&q=85",
    accent: "#C7A96B",
    featured: true,
  },
  {
    slug: "silk-route",
    name: "محمصة طريق الحرير",
    shortName: "طريق الحرير",
    description: "قهوة فلتر أنيقة بقوام شبيه بالشاي وروائح هادئة.",
    about:
      "طريق الحرير تهتم بالتفاصيل الدقيقة: تفتح بطيء، حلاوة خفيفة، ونهاية نظيفة تجعل الوصفة تبدو بسيطة لكنها محسوبة.",
    location: "عمّان، الأردن",
    logo: "SR",
    coverImage:
      "https://images.unsplash.com/photo-1741993677862-e64b3b074647?auto=format&fit=crop&w=1800&q=85",
    accent: "#6F4A38",
  },
];

export const recipes: Recipe[] = [
  {
    slug: "northline-v60-citrus",
    roasterSlug: "northline",
    name: "V60 الحمضيات الهادئة",
    method: "Filter",
    difficulty: "Medium",
    brewTime: 4,
    image:
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1400&q=85",
    summary: "كوب فلتر واضح بلمسة قشر برتقال وعسل ونهاية نظيفة.",
    tools: ["V60", "فلتر ورقي", "غلاية رقبة", "ميزان", "مؤقت"],
    ingredients: ["18 جم قهوة", "300 جم ماء بدرجة 93", "طحنة متوسطة ناعمة"],
    steps: [
      "اشطف الفلتر وسخّن أداة التحضير.",
      "ابدأ بالتفتح باستخدام 45 جم ماء لمدة 40 ثانية.",
      "اسكب حتى 180 جم بحركة دائرية هادئة ثم انتظر نزول مستوى القهوة.",
      "أكمل حتى 300 جم واجعل وقت التحضير قريبًا من 4 دقائق.",
    ],
    featured: true,
  },
  {
    slug: "northline-iced-filter",
    roasterSlug: "northline",
    name: "فلتر بارد بطابع فاكهي",
    method: "Filter",
    difficulty: "Easy",
    brewTime: 3,
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1400&q=85",
    summary: "فلتر بارد بحموضة خفيفة وقوام نظيف.",
    tools: ["أداة فلتر مسطحة", "فلتر ورقي", "ميزان", "ثلج"],
    ingredients: ["20 جم قهوة", "180 جم ماء ساخن", "120 جم ثلج", "طحنة متوسطة"],
    steps: [
      "ضع الثلج في السيرفر واشطف الفلتر بشكل منفصل.",
      "ابدأ التفتح بـ 45 جم ماء لمدة 35 ثانية.",
      "اسكب بثبات حتى 180 جم خلال دقيقتين.",
      "حرّك المشروب فوق الثلج وقدّمه مباشرة.",
    ],
    featured: true,
  },
  {
    slug: "lumen-house-espresso",
    roasterSlug: "lumen",
    name: "إسبريسو البيت",
    method: "Espresso",
    difficulty: "Advanced",
    brewTime: 1,
    image:
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1400&q=85",
    summary: "إسبريسو كثيف بحلاوة كراميل ونهاية قصيرة ومركزة.",
    tools: ["آلة إسبريسو", "سلة 58 مم", "تامبر", "ميزان", "مؤقت"],
    ingredients: ["18 جم قهوة", "38 جم استخلاص", "ماء مفلتر"],
    steps: [
      "اطحن القهوة بدرجة ناعمة ووزّعها بهدوء في السلة.",
      "اضغط بشكل مستوٍ وثابت.",
      "استخلص 38 جم خلال 27 إلى 31 ثانية.",
      "حرّك الإسبريسو مرة واحدة قبل التذوق.",
    ],
    featured: true,
  },
  {
    slug: "lumen-vanilla-cloud",
    roasterSlug: "lumen",
    name: "لاتيه فانيلا ناعم",
    method: "Espresso",
    difficulty: "Medium",
    brewTime: 5,
    image:
      "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=1400&q=85",
    summary: "حليب حريري، إسبريسو متوازن، ولمسة فانيلا خفيفة.",
    tools: ["آلة إسبريسو", "إبريق تبخير", "عصا تبخير", "كوب زجاجي"],
    ingredients: ["18 جم جرعة إسبريسو", "150 جم حليب", "8 جم شراب فانيلا"],
    steps: [
      "استخلص الإسبريسو في كوب دافئ.",
      "بخّر الحليب حتى يصبح لامعًا وناعمًا.",
      "اخلط الفانيلا مع الإسبريسو.",
      "اسكب الحليب ببطء وحافظ على خفة المشروب.",
    ],
  },
  {
    slug: "ember-cold-brew",
    roasterSlug: "ember-yard",
    name: "كولد برو مخملي",
    method: "Cold Brew",
    difficulty: "Easy",
    brewTime: 12,
    image:
      "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=1400&q=85",
    summary: "كولد برو منخفض الحموضة بطابع كاكاو وقوام كثيف.",
    tools: ["مرطبان زجاجي", "كيس ترشيح", "ميزان", "مصفاة ناعمة"],
    ingredients: ["80 جم قهوة", "640 جم ماء بارد", "طحنة خشنة"],
    steps: [
      "اخلط القهوة والماء في مرطبان نظيف.",
      "اتركه في الثلاجة لمدة 12 ساعة.",
      "رشّحه مرة بكيس الترشيح ثم مرة بفلتر ورقي.",
      "قدّمه بنسبة جزء مركز إلى جزء ماء أو حليب.",
    ],
    featured: true,
  },
  {
    slug: "ember-iced-tonic",
    roasterSlug: "ember-yard",
    name: "إسبريسو تونيك",
    method: "Espresso",
    difficulty: "Medium",
    brewTime: 4,
    image:
      "https://images.unsplash.com/photo-1522992319-0365e5f11656?auto=format&fit=crop&w=1400&q=85",
    summary: "مشروب فوار يجمع مرارة نظيفة ولمسة حمضية.",
    tools: ["آلة إسبريسو", "كوب طويل", "ثلج", "ملعقة بار"],
    ingredients: ["36 جم إسبريسو", "140 جم تونيك", "ثلج", "قشر برتقال"],
    steps: [
      "املأ الكوب بثلج شفاف.",
      "اسكب التونيك ببطء فوق الثلج.",
      "استخلص الإسبريسو في كوب منفصل.",
      "اسكب الإسبريسو فوق التونيك وأنهِه بقشر البرتقال.",
    ],
  },
  {
    slug: "silk-route-chemex",
    roasterSlug: "silk-route",
    name: "كيمكس طريق الحرير",
    method: "Filter",
    difficulty: "Medium",
    brewTime: 5,
    image:
      "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=1400&q=85",
    summary: "كوب ناعم شبيه بالشاي بلمسات زهرية ونهاية طويلة.",
    tools: ["كيمكس", "فلتر كيمكس", "غلاية رقبة", "ميزان"],
    ingredients: ["24 جم قهوة", "390 جم ماء بدرجة 94", "طحنة متوسطة خشنة"],
    steps: [
      "اشطف الفلتر جيدًا وتخلص من ماء الشطف.",
      "ابدأ التفتح بـ 60 جم ماء لمدة 45 ثانية.",
      "اسكب على ثلاث دفعات هادئة حتى 390 جم.",
      "اترك السطح ينزل بالكامل ثم قدّم القهوة.",
    ],
  },
  {
    slug: "silk-route-cold-flower",
    roasterSlug: "silk-route",
    name: "تحضير بارد زهري",
    method: "Cold Brew",
    difficulty: "Easy",
    brewTime: 10,
    image:
      "https://images.unsplash.com/photo-1494314671902-399b18174975?auto=format&fit=crop&w=1400&q=85",
    summary: "كولد برو رقيق للقهوة الزهرية والتحميص الفاتح.",
    tools: ["برج تقطير بارد", "فلتر ورقي", "ميزان", "سيرفر"],
    ingredients: ["45 جم قهوة", "450 جم ماء مثلج", "طحنة متوسطة"],
    steps: [
      "جهّز الفلتر وبلّل سطح القهوة بالتساوي.",
      "اضبط التقطير على قطرة واحدة كل ثانية.",
      "اترك التحضير يكتمل خلال 10 ساعات.",
      "برّده قليلًا وقدّمه دون تخفيف.",
    ],
  },
];

export function getRoaster(slug: string) {
  return roasters.find((roaster) => roaster.slug === slug);
}

export function getRecipe(slug: string) {
  return recipes.find((recipe) => recipe.slug === slug);
}

export function getRecipesByRoaster(slug: string) {
  return recipes.filter((recipe) => recipe.roasterSlug === slug);
}

export function getRoasterForRecipe(recipe: Recipe) {
  return roasters.find((roaster) => roaster.slug === recipe.roasterSlug);
}
