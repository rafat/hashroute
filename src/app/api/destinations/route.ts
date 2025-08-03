// src/app/api/destinations/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const originNodeId = searchParams.get('originNodeId');

    if (!originNodeId) {
      return NextResponse.json({ error: 'originNodeId is required' }, { status: 400 });
    }

    // This query is the core of the logic:
    // 1. Select the distinct `destination_node_id` from the routes table
    // 2. Where the `origin_node_id` matches the one provided.
    // This gives us a list of all reachable destination IDs.
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .select('destination_node_id')
      .eq('origin_node_id', originNodeId);

    if (routeError) throw routeError;

    const destinationIds = routeData.map(r => r.destination_node_id);

    // Now, fetch the full details for those destination nodes
    const { data: nodesData, error: nodesError } = await supabase
      .from('nodes')
      .select('*')
      .in('id', destinationIds);
    
    if (nodesError) throw nodesError;

    return NextResponse.json({ destinations: nodesData });

  } catch (error: unknown) {
    console.error('API Error in /api/destinations:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}