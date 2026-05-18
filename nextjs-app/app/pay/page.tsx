import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import MonthlyStatement from '@/components/monthly-statement/MonthlyStatement';
import { readMonthlyStatement } from '@/lib/monthlyStatement';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
    title: 'Monthly Budget Statement',
    robots: {
        index: false,
        follow: false,
    },
};

const isAllowedHost = (hostHeader: string | null) => {
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    const host = (hostHeader ?? '').toLowerCase();
    return host === 'pay.yusteven.com' || host.startsWith('pay.yusteven.com:');
};

export default async function PayPage() {
    const requestHeaders = await headers();

    if (!isAllowedHost(requestHeaders.get('host'))) {
        notFound();
    }

    const statement = await readMonthlyStatement();

    return <MonthlyStatement initialData={statement} />;
}
