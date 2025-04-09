import { NextResponse } from 'next/server';

export async function GET() {  
  const githubUrl = `https://raw.githubusercontent.com/Popcorn-Limited/bvusd-api/main/docs/v2/bsc.json`;

  try {
    const res = await fetch(githubUrl);

    if (!res.ok) {
      return NextResponse.json({ error: 'File not found on GitHub' }, { status: 404 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching GitHub file:', err);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}