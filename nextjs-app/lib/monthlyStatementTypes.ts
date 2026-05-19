export interface StatementMeta {
    accountNumber: string;
    beginningBalance: number;
}

export interface StatementTransaction {
    id: number;
    desc: string;
    amount: number;
}

export interface MonthlyStatementData {
    meta: StatementMeta;
    transactions: StatementTransaction[];
    updatedAt?: string;
}
