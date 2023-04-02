import { bot, prisma } from '../main';

async function main() {
  console.log('Bot running...');
  await bot.start();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
