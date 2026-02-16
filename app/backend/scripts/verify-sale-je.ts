import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const saleNumber = 'SAL-20260216-0002';
    const entries = await prisma.journalEntry.findMany({
        where: {
            description: {
                contains: saleNumber
            }
        },
        include: {
            lines: {
                include: { account: true }
            }
        }
    });

    if (entries.length === 0) {
        console.log('No journal entries found for this sale number.');
        return;
    }

    const result = entries.map(je => ({
        entryNumber: je.entryNumber,
        description: je.description,
        totalDebit: je.lines.reduce((sum, l) => sum + (l.debit || 0), 0),
        totalCredit: je.lines.reduce((sum, l) => sum + (l.credit || 0), 0),
        lines: je.lines.map(l => ({
            account: l.account.name,
            code: l.account.code,
            debit: l.debit,
            credit: l.credit
        }))
    }));

    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
