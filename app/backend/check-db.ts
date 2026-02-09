import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
    const user = await prisma.user.findUnique({
        where: { username: 'admin' },
    });

    if (user) {
        console.log('✅ Found admin user:', user.username);
        console.log('📧 Email:', user.email);
        console.log('🔑 Password Hash exists:', !!user.passwordHash);
        console.log('📅 Created At:', user.createdAt);
    } else {
        console.log('❌ Admin user NOT found');
    }
}

checkAdmin()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
