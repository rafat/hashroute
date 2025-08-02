// src/app/api/routes/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Use the public client for read-only ops

interface RouteRow {
  route_path: string[];
}
interface NodeRow {
  id: string;
  hedera_address: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const originNodeId = searchParams.get('originNodeId');
    const destNodeId = searchParams.get('destNodeId');

    if (!originNodeId || !destNodeId) {
      return NextResponse.json({ error: 'originNodeId and destNodeId are required' }, { status: 400 });
    }

    // 1. Fetch the highest-ranked (rank=1) pure node route from Supabase
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .select('route_path')
      .eq('origin_node_id', originNodeId)
      .eq('destination_node_id', destNodeId)
      .order('rank', { ascending: true }) // Order by rank just in case
      .limit(1)
      .single()
      .overrideTypes<RouteRow>();

    if (routeError || !routeData) {
      console.error('Supabase route fetch error:', routeError);
      return NextResponse.json({ error: 'No route found for the selected nodes.' }, { status: 404 });
    }

    const nodeIds = routeData.route_path;

    // 2. Fetch the details (including Hedera addresses) for each node in the path
    const { data: nodesData, error: nodesError } = await supabase
      .from('nodes')
      .select('id, hedera_address')
      .in('id', nodeIds)
      .overrideTypes<NodeRow[]>();
      
    if (nodesError) {
      console.error('Supabase nodes fetch error:', nodesError);
      throw new Error('Failed to fetch node details for the route.');
    }

    // 3. Map the node UUIDs to their corresponding Hedera addresses in the correct order
    const orderedAddresses = nodeIds.map(id => 
      (nodesData.find(node => node.id === id))?.hedera_address
    ).filter(Boolean); // Filter out any potential undefined values

    if(orderedAddresses.length !== nodeIds.length){
        throw new Error('Mismatch between route path and fetched node addresses.');
    }

    return NextResponse.json({ route: orderedAddresses });
  } catch (error: unknown) {
    console.error('API Error in /api/routes:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}