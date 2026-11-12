import { authenticated, failure } from '@/lib/api';
import { modelPrices } from '@/lib/gateway';
export async function GET(){try{await authenticated();return Response.json({prices:await modelPrices()});}catch(e){return failure(e);}}
