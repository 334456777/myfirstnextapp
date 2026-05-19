import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import type { MonthlyStatementData, StatementMeta, StatementTransaction } from './monthlyStatementTypes';

export const defaultMonthlyStatement: MonthlyStatementData = {
    meta: {
        accountNumber: '000000000000',
        beginningBalance: 0,
    },
    transactions: [],
};

const cloneDefaultStatement = (): MonthlyStatementData =>
    JSON.parse(JSON.stringify(defaultMonthlyStatement)) as MonthlyStatementData;

const statementFilePath = () => {
    const configuredPath = process.env.MONTHLY_STATEMENT_DATA_PATH?.trim();
    return configuredPath
        ? path.resolve(configuredPath)
        : path.join(process.cwd(), 'data', 'monthly-statement.json');
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
};

const toStringValue = (value: unknown, fallback: string) =>
    typeof value === 'string' ? value.slice(0, 500) : fallback;

const toNumberValue = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const clean = value.replace(/[^\d.-]/g, '');
        const parsed = Number(clean);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
};

export function normalizeMonthlyStatement(input: unknown): MonthlyStatementData {
    const fallback = cloneDefaultStatement();
    const root = asRecord(input);

    if (!root) {
        return fallback;
    }

    const rawMeta = asRecord(root.meta);
    const meta: StatementMeta = {
        accountNumber: toStringValue(rawMeta?.accountNumber, fallback.meta.accountNumber),
        beginningBalance: toNumberValue(rawMeta?.beginningBalance, fallback.meta.beginningBalance),
    };

    const rawTransactions = Array.isArray(root.transactions) ? root.transactions : fallback.transactions;
    const transactions: StatementTransaction[] = rawTransactions.map((item, index) => {
        const record = asRecord(item);
        const fallbackTransaction = fallback.transactions[index] ?? { id: index + 1, desc: '', amount: 0 };

        return {
            id: Math.trunc(toNumberValue(record?.id, fallbackTransaction.id || index + 1)),
            desc: toStringValue(record?.desc, fallbackTransaction.desc),
            amount: toNumberValue(record?.amount, fallbackTransaction.amount),
        };
    });

    return {
        meta,
        transactions,
        updatedAt: typeof root.updatedAt === 'string' ? root.updatedAt : undefined,
    };
}

export async function readMonthlyStatement(): Promise<MonthlyStatementData> {
    const filePath = statementFilePath();

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return normalizeMonthlyStatement(JSON.parse(content));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return cloneDefaultStatement();
        }

        throw error;
    }
}

export async function writeMonthlyStatement(input: unknown): Promise<MonthlyStatementData> {
    const filePath = statementFilePath();
    const directory = path.dirname(filePath);
    const normalized = {
        ...normalizeMonthlyStatement(input),
        updatedAt: new Date().toISOString(),
    };

    await fs.mkdir(directory, { recursive: true });

    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf-8');
    await fs.rename(tempPath, filePath);

    return normalized;
}
