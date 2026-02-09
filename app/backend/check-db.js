
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- DATABASE DIAGNOSIS ---');
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, isActive: true, lastLoginAt: true }
        });
        console.log('Users in DB:', JSON.stringify(users, null, 2));

        const auditLogs = await prisma.auditLog.findMany({
            take: 5,
            orderBy: { timestamp: 'desc' }
        });
        console.log('Recent Audit Logs:', JSON.stringify(auditLogs, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
