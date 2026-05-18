'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { MonthlyStatementData, StatementTransaction } from '@/lib/monthlyStatementTypes';
import styles from './MonthlyStatement.module.css';

type EditableTransaction = Omit<StatementTransaction, 'amount'> & {
    amount: number | '';
};

type EditableStatement = Omit<MonthlyStatementData, 'transactions'> & {
    transactions: EditableTransaction[];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface MonthlyStatementProps {
    initialData: MonthlyStatementData;
}

const toEditableStatement = (data: MonthlyStatementData): EditableStatement => ({
    ...data,
    transactions: data.transactions.map((transaction) => ({ ...transaction })),
});

const toPersistableStatement = (data: EditableStatement): MonthlyStatementData => ({
    meta: {
        ...data.meta,
        beginningBalance: Number(data.meta.beginningBalance) || 0,
    },
    transactions: data.transactions.map((transaction) => ({
        id: transaction.id,
        desc: transaction.desc,
        amount: Number(transaction.amount) || 0,
    })),
    updatedAt: data.updatedAt,
});

const currency = (value: number | string) =>
    `\u00a5${Math.trunc(Number(value) || 0).toLocaleString('en-US')}`;

const Icon = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {children}
    </svg>
);

const PlusIcon = () => (
    <Icon size={11}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </Icon>
);

const TrashIcon = () => (
    <Icon size={12}>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
    </Icon>
);

const EditIcon = () => (
    <Icon size={11}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </Icon>
);

const EyeIcon = () => (
    <Icon size={11}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </Icon>
);

export default function MonthlyStatement({ initialData }: MonthlyStatementProps) {
    const [statement, setStatement] = useState<EditableStatement>(() => toEditableStatement(initialData));
    const [isEditing, setIsEditing] = useState(true);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const { meta, transactions } = statement;

    const daysInMonth = useMemo(() => {
        const date = new Date(meta.periodStart);
        if (Number.isNaN(date.getTime())) {
            return 30;
        }

        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }, [meta.periodStart]);

    const monthName = useMemo(() => {
        const date = new Date(meta.periodStart);
        if (Number.isNaN(date.getTime())) {
            return '-';
        }

        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [meta.periodStart]);

    const total = useMemo(
        () => transactions.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0),
        [transactions]
    );

    const netAvailable = useMemo(
        () => (Number(meta.beginningBalance) || 0) - total,
        [meta.beginningBalance, total]
    );

    const dailyAllowance = useMemo(
        () => (daysInMonth > 0 ? netAvailable / daysInMonth : 0),
        [daysInMonth, netAvailable]
    );

    const nextId = useMemo(
        () => Math.max(0, ...transactions.map((transaction) => transaction.id)) + 1,
        [transactions]
    );

    const amountInputWidth = useMemo(() => {
        const maxLength = Math.max(...transactions.map((transaction) => String(transaction.amount ?? '').length), 4);
        return `${maxLength + 1}ch`;
    }, [transactions]);

    const updateMeta = (field: keyof EditableStatement['meta'], value: string | number) => {
        setSaveState('idle');
        setStatement((current) => ({
            ...current,
            meta: {
                ...current.meta,
                [field]: value,
            },
        }));
    };

    const updateBeginningBalance = (value: string) => {
        const clean = value.replace(/[^\d.]/g, '');
        updateMeta('beginningBalance', clean === '' ? 0 : Number(clean));
    };

    const updateTransaction = (id: number, field: 'desc' | 'amount', value: string) => {
        setSaveState('idle');
        setStatement((current) => ({
            ...current,
            transactions: current.transactions.map((transaction) => {
                if (transaction.id !== id) {
                    return transaction;
                }

                if (field === 'amount') {
                    const clean = value.replace(/[^\d.]/g, '');
                    return { ...transaction, amount: clean === '' ? '' : Number(clean) };
                }

                return { ...transaction, [field]: value };
            }),
        }));
    };

    const addTransaction = () => {
        setSaveState('idle');
        setStatement((current) => ({
            ...current,
            transactions: [...current.transactions, { id: nextId, desc: '', amount: 0 }],
        }));
    };

    const removeTransaction = (id: number) => {
        setSaveState('idle');
        setStatement((current) => ({
            ...current,
            transactions: current.transactions.filter((transaction) => transaction.id !== id),
        }));
    };

    const saveStatement = async () => {
        setSaveState('saving');
        setErrorMessage('');

        try {
            const response = await fetch('/api/monthly-statement', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(toPersistableStatement(statement)),
            });

            if (!response.ok) {
                throw new Error(`Save failed with ${response.status}`);
            }

            const savedStatement = (await response.json()) as MonthlyStatementData;
            setStatement(toEditableStatement(savedStatement));
            setSaveState('saved');
            setIsEditing(false);
        } catch (error) {
            setSaveState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Save failed');
        }
    };

    const toggleMode = async () => {
        if (saveState === 'saving') {
            return;
        }

        if (isEditing) {
            await saveStatement();
            return;
        }

        setSaveState('idle');
        setIsEditing(true);
    };

    return (
        <main className={styles.page}>
            <div className={styles.frame}>
                <div className={`${styles.toolbar} ${styles.noPrint}`}>
                    <span className={styles.status} role={saveState === 'error' ? 'alert' : 'status'}>
                        {saveState === 'saving' && 'Saving...'}
                        {saveState === 'saved' && statement.updatedAt && `Saved ${new Date(statement.updatedAt).toLocaleString()}`}
                        {saveState === 'error' && errorMessage}
                    </span>
                    <button
                        type="button"
                        onClick={toggleMode}
                        disabled={saveState === 'saving'}
                        className={`${styles.modeButton} ${isEditing ? styles.editingButton : styles.readOnlyButton}`}
                    >
                        {isEditing ? <EditIcon /> : <EyeIcon />}
                        {saveState === 'saving' ? 'SAVING' : isEditing ? 'EDITING' : 'READ ONLY'}
                    </button>
                </div>

                <section className={styles.statementCard} aria-label="Monthly budget statement">
                    <div className={styles.meta}>
                        <div>
                            <input
                                value={meta.periodStart}
                                onChange={(event) => updateMeta('periodStart', event.target.value)}
                                readOnly={!isEditing}
                                className={styles.cellInput}
                                style={{ width: 130, textAlign: 'right' }}
                            />
                            {' through '}
                            <input
                                value={meta.periodEnd}
                                onChange={(event) => updateMeta('periodEnd', event.target.value)}
                                readOnly={!isEditing}
                                className={styles.cellInput}
                                style={{ width: 130, textAlign: 'right' }}
                            />
                        </div>
                        <div>
                            Primary Account:{' '}
                            <input
                                value={meta.accountNumber}
                                onChange={(event) => updateMeta('accountNumber', event.target.value)}
                                readOnly={!isEditing}
                                className={styles.cellInput}
                                style={{ width: 140, textAlign: 'right', fontWeight: 700 }}
                            />
                        </div>
                        <div className={styles.balanceLine}>
                            Beginning Balance: {'\u00a5'}
                            <input
                                type="text"
                                inputMode="decimal"
                                value={meta.beginningBalance}
                                onChange={(event) => updateBeginningBalance(event.target.value)}
                                readOnly={!isEditing}
                                className={`${styles.cellInput} ${styles.tabular}`}
                                style={{ width: 90, textAlign: 'right', fontWeight: 700 }}
                            />
                        </div>
                    </div>

                    <div className={styles.sectionLabel}>FIXED EXPENSES</div>
                    <div className={styles.rule} />

                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>DESCRIPTION</th>
                                <th className={styles.amountHeader}>AMOUNT</th>
                                <th className={styles.noPrint} style={{ width: isEditing ? 28 : 0 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((transaction) => (
                                <tr key={transaction.id} className={styles.rowGroup}>
                                    <td>
                                        <input
                                            value={transaction.desc}
                                            onChange={(event) => updateTransaction(transaction.id, 'desc', event.target.value)}
                                            readOnly={!isEditing}
                                            className={styles.cellInput}
                                            style={{ width: '100%' }}
                                        />
                                    </td>
                                    <td className={`${styles.amountCell} ${styles.tabular}`}>
                                        {isEditing ? (
                                            <>
                                                <span>{'-\u00a5'}</span>
                                                <input
                                                    value={transaction.amount}
                                                    onChange={(event) => updateTransaction(transaction.id, 'amount', event.target.value)}
                                                    className={`${styles.cellInput} ${styles.tabular}`}
                                                    style={{
                                                        width: amountInputWidth,
                                                        textAlign: 'right',
                                                        display: 'inline-block',
                                                    }}
                                                    inputMode="decimal"
                                                />
                                            </>
                                        ) : (
                                            <span>-{currency(transaction.amount)}</span>
                                        )}
                                    </td>
                                    <td className={`${styles.deleteCell} ${styles.noPrint}`} style={{ width: isEditing ? 28 : 0 }}>
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={() => removeTransaction(transaction.id)}
                                                className={styles.deleteButton}
                                                title="Delete row"
                                            >
                                                <TrashIcon />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {isEditing && (
                                <tr className={styles.noPrint}>
                                    <td colSpan={3} className={styles.addRowCell}>
                                        <button type="button" onClick={addTransaction} className={styles.addButton}>
                                            <PlusIcon />
                                            ADD ROW
                                        </button>
                                    </td>
                                </tr>
                            )}

                            <tr className={styles.totalRow}>
                                <td>Total Fixed Expenses</td>
                                <td className={styles.tabular}>-{currency(total)}</td>
                                <td className={styles.noPrint} style={{ width: isEditing ? 28 : 0 }} />
                            </tr>
                        </tbody>
                    </table>

                    <div className={styles.allowanceSection}>
                        <div className={styles.sectionLabel}>DAILY ALLOWANCE</div>
                        <div className={styles.rule} />

                        <div className={styles.allowanceSummary}>
                            <div className={`${styles.dailyAmount} ${styles.tabular}`}>{currency(dailyAllowance)}</div>
                            <div className={styles.allowanceCaption}>
                                AVAILABLE PER DAY {'\u00b7'} {daysInMonth} DAYS IN {monthName.toUpperCase()}
                            </div>
                            <div className={styles.allowanceMath}>
                                ({currency(meta.beginningBalance)} {'\u2212'} {currency(total)}) {'\u00f7'} {daysInMonth} ={' '}
                                {currency(netAvailable)} {'\u00f7'} {daysInMonth}
                            </div>
                        </div>
                    </div>

                    <footer className={styles.footer}>Personal monthly statement - for budgeting reference only.</footer>
                </section>
            </div>
        </main>
    );
}
