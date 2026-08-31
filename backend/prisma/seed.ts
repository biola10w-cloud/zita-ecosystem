import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryDef {
  name: string;
  icon: string;
  children: string[];
}

const CATEGORIES: CategoryDef[] = [
  { name: 'Personal Development', icon: '🌱', children: ['Habits', 'Mindset', 'Productivity', 'Motivation', 'Self-discipline'] },
  { name: 'Financial Intelligence', icon: '💰', children: ['Money management', 'Investing', 'Wealth building', 'Financial freedom', 'Business finance'] },
  { name: 'Business & Entrepreneurship', icon: '💼', children: ['Startups', 'Leadership', 'Management', 'Strategy', 'Innovation'] },
  { name: 'Emotional & Mental Growth', icon: '🧠', children: ['Emotional intelligence', 'Healing', 'Trauma recovery', 'Self-awareness', 'Confidence'] },
  { name: 'Christian Faith & Spiritual Growth', icon: '✝️', children: ['Purpose', 'Prayer', 'Spiritual warfare', 'Christian living', 'Devotionals'] },
  { name: 'Character Building', icon: '🛡️', children: ['Discipline', 'Integrity', 'Courage', 'Resilience', 'Stoicism'] },
  { name: 'Relationships & Communication', icon: '💬', children: ['Marriage', 'Dating', 'Family', 'Communication skills', 'Conflict resolution'] },
  { name: 'Health & Wellness', icon: '🧘', children: ['Fitness', 'Nutrition', 'Mental health', 'Healthy living', 'Stress management'] },
  { name: 'Career & Professional Growth', icon: '📈', children: ['Career development', 'Workplace skills', 'Productivity at work', 'Leadership at work', 'Personal branding'] },
  { name: 'Creativity & Purpose', icon: '🎨', children: ['Creativity', 'Purpose discovery', 'Life calling', 'Inspiration', 'Art & expression'] },
  { name: 'Technology & Future Skills', icon: '💻', children: ['AI', 'Coding', 'Digital skills', 'Tech trends', 'Innovation'] },
  { name: 'Youth & Teen Development', icon: '🎓', children: ['Teen mindset', 'Early financial education', 'Character for youth', 'Study habits', 'Life skills'] },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  const expectedSlugs = new Set<string>();

  for (const category of CATEGORIES) {
    const parentSlug = slugify(category.name);

    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      create: { name: category.name, slug: parentSlug, icon: category.icon, parentId: null },
      update: { name: category.name, icon: category.icon, parentId: null },
    });
    expectedSlugs.add(parentSlug);

    for (const childName of category.children) {
      // Prefix with the parent slug since child names (e.g. "Innovation")
      // repeat across different parent categories.
      const childSlug = `${parentSlug}-${slugify(childName)}`;

      await prisma.category.upsert({
        where: { slug: childSlug },
        create: { name: childName, slug: childSlug, parentId: parent.id },
        update: { name: childName, parentId: parent.id },
      });
      expectedSlugs.add(childSlug);
    }
  }

  // Remove leftover categories from earlier flat seed data that have no
  // books assigned (safe to prune; anything with books is left alone).
  const stale = await prisma.category.findMany({
    where: { slug: { notIn: Array.from(expectedSlugs) } },
    include: { _count: { select: { books: true } } },
  });
  const staleIds = stale.filter((c) => c._count.books === 0).map((c) => c.id);
  if (staleIds.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: staleIds } } });
  }

  const total = await prisma.category.count();
  console.log(
    `Seeded ${CATEGORIES.length} top-level categories (${total} total incl. subcategories), pruned ${staleIds.length} stale entries`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
