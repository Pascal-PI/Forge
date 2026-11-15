'use strict';
// Mount this handler on a trusted HTTPS service after supplying a real session
// authenticator and the durable, cross-instance-locked account store required
// by stripe-service.cjs. Account IDs are never accepted from request bodies.
function createBillingHttpHandler({billing,authenticate}){
  if(!billing||typeof authenticate!=='function')throw Error('Billing and a trusted authenticator are required.');
  function send(res,status,data){const body=Buffer.from(JSON.stringify(data));res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body);}
  async function raw(req,limit){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('Request is too large.');chunks.push(chunk);}return Buffer.concat(chunks);}
  return async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');if(url.search){send(res,400,{error:'Invalid request.'});return;}
      if(req.method==='POST'&&url.pathname==='/v1/billing/stripe-webhook'){
        const bytes=await raw(req,1024*1024),signature=req.headers['stripe-signature'];
        try{billing.webhook(bytes,signature);send(res,200,{received:true});}catch{send(res,400,{error:'Invalid webhook.'});}return;
      }
      const routes={'GET /v1/billing/status':'status','POST /v1/billing/checkout':'checkout','POST /v1/billing/portal':'portal'},action=routes[`${req.method} ${url.pathname}`];
      if(!action){send(res,404,{error:'Not found.'});return;}
      if(req.method==='POST'){const bytes=await raw(req,1024);if(bytes.length&&!/^\s*(?:\{\})?\s*$/.test(bytes.toString('utf8'))){send(res,400,{error:'No request fields are accepted.'});return;}}
      const identity=await authenticate(req);if(!identity||typeof identity.accountId!=='string'){send(res,401,{error:'Sign in to manage billing.'});return;}
      const result=await billing[action](identity.accountId);send(res,200,result);
    }catch{if(!res.headersSent)send(res,503,{error:'Billing is unavailable. Please try again later.'});else res.end();}
  };
}
module.exports={createBillingHttpHandler};
