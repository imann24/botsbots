import 'server-only';
import { z } from 'zod';
import { adminClient, userClient } from './supabase/server';
export class ApiError extends Error {constructor(message:string,public status=400){super(message);}}
export async function authenticated(request?:Request){
 if(request && request.method!=='GET'){
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw new ApiError('Cross-origin requests are not allowed.',403);
 }
 const db=await userClient();const {data:{user},error}=await db.auth.getUser();
 if(error||!user) throw new ApiError('Sign in to continue.',401);
 return {user,db,admin:adminClient()};
}
export async function jsonBody(request:Request){
 const text=await request.text();if(Buffer.byteLength(text)>30000) throw new ApiError('Request is too large.',413);
 try{return JSON.parse(text);}catch{throw new ApiError('Invalid JSON.');}
}
export function failure(error:unknown){
 if(error instanceof z.ZodError) return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400});
 if(error instanceof ApiError) return Response.json({error:error.message},{status:error.status});
 console.error('Request failed:',error instanceof Error?error.message:'Database operation failed');
 return Response.json({error:'The request could not finish. Check that local Supabase is running and try again.'},{status:500});
}
export function check(error:{message:string}|null){if(error) throw new ApiError(error.message);}
