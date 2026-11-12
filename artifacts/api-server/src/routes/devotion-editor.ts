import { Router } from "express";
import { requireAdminRole } from "../lib/adminAuth.js";
import { devotionTransaction } from "../lib/devotion-library.js";
import { verifyScripture } from "../lib/devotion-expansion.js";
import { createEntry,editEntry,scheduleEntry,setEntryVisibility,listEntries,editorialContent,EditorialError } from "../lib/devotion-editor.js";
import { invalidateDevotionPrerenderCache } from "../lib/devotion-prerender.js";
const router=Router();
router.use("/devotion/admin/entries",requireAdminRole("livestream"));
function error(res:import("express").Response,e:unknown) {
  const code=(e as {code?:string}).code;
  res.status(e instanceof EditorialError?e.status:code==="23505"?409:422).json({error:code==="23505"?"An identity or publication date is already reserved":e instanceof Error?e.message:"Editorial request failed"});
}
router.get("/devotion/admin/entries",async(req,res)=>{
  try {res.json(await listEntries(req.query));} catch(e){error(res,e);}
});
router.post("/devotion/admin/entries",async(req,res)=>{
  try {
    if(req.body.confirmReviewed!==true) throw new EditorialError("Confirm pastoral review before saving",400);
    const c=editorialContent(req.body.content); await verifyScripture(c);
    res.status(201).json(await devotionTransaction(client=>createEntry(client,c)));
  }catch(e){error(res,e);}
});
router.put("/devotion/admin/entries/:id",async(req,res)=>{
  try {
    if(req.body.confirmReviewed!==true) throw new EditorialError("Confirm pastoral review before saving",400);
    const c=editorialContent(req.body.content); await verifyScripture(c);
    res.json(await devotionTransaction(client=>editEntry(client,String(req.params.id),req.body.revision,c)));
  }catch(e){error(res,e);}
});
router.post("/devotion/admin/entries/:id/schedule",async(req,res)=>{
  try {res.json(await devotionTransaction(client=>scheduleEntry(client,String(req.params.id),req.body.revision,req.body.date)));}
  catch(e){error(res,e);}
});
for(const action of ["publish","unpublish"] as const) router.post(`/devotion/admin/entries/:id/${action}`,async(req,res)=>{
  try {
    const result=await devotionTransaction(client=>setEntryVisibility(client,String(req.params.id),req.body.revision,action==="publish"));
    invalidateDevotionPrerenderCache();
    res.json(result);
  }
  catch(e){error(res,e);}
});
export default router;
