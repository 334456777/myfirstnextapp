import { NextRequest, NextResponse } from 'next/server';
import { readMonthlyStatement, writeMonthlyStatement } from '@/lib/monthlyStatement';

const privateHeaders = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
};

const isAllowedHost = (hostHeader: string | null) => {
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }

    const host = (hostHeader ?? '').toLowerCase();
    return host === 'pay.yusteven.com' || host.startsWith('pay.yusteven.com:');
};

export async function GET(request: NextRequest) {
    if (!isAllowedHost(request.headers.get('host'))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
    }

    const data = await readMonthlyStatement();
    return NextResponse.json(data, { headers: privateHeaders });
}

export async function PUT(request: NextRequest) {
    if (!isAllowedHost(request.headers.get('host'))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
    }

    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: privateHeaders });
    }

    const data = await writeMonthlyStatement(payload);
    return NextResponse.json(data, { headers: privateHeaders });
}
