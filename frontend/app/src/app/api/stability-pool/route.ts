import { NextRequest, NextResponse } from 'next/server';
import { getAssetTransfers, getStabilityPoolDepositsFromAssetTransfersStringified, getYUSNDDepositsFromAssetTransfersStringified } from '@/src/shellpoints/lib/tokenholders';
import { CONTRACT_ADDRESSES } from '@/src/contracts';
import { Address } from 'viem';


export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json() as { addresses: Address[] | undefined };
    const deposits = await getAssetTransfers({
      tokenAddresses: [CONTRACT_ADDRESSES.BoldToken],
      toAddresses: CONTRACT_ADDRESSES.collaterals.map(coll => coll.contracts.StabilityPool),
      fromAddresses: addresses,
    })
    const yusndDeposits = await getAssetTransfers({
      tokenAddresses: [CONTRACT_ADDRESSES.YUSND],
      toAddresses: addresses,
    })
    const depositors = getStabilityPoolDepositsFromAssetTransfersStringified(deposits)
    const yusndDepositors = getYUSNDDepositsFromAssetTransfersStringified(yusndDeposits)
    
    return NextResponse.json({
      success: true,
      result: {
        stabilityPool: depositors,
        yusnd: yusndDepositors,
      },
    });
  } catch (error) {
    console.error('Error fetching stability pool depositors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stability pool depositors' },
      { status: 500 }
    );
  }
}