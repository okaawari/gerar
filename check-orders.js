const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const statuses = await prisma.order.findMany({
    select: { status: true },
    distinct: ['status']
  });
  console.log('Order Statuses:', statuses);
  
  const lastOrder = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, contactPhoneNumber: true }
  });
  console.log('Last Order:', lastOrder);
  
  await prisma.$disconnect();
}

main();
